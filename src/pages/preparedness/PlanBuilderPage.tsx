import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, Download, ListPlus, Plus, RotateCcw
} from 'lucide-react';
import { useRecords } from '../../hooks/useRecords';
import { saveRecord, deleteRecord } from '../../lib/repo';
import { exportDocumentPdf } from '../../lib/pdf';
import {
  Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, Select, StatCard, Textarea
} from '../../components/ui';
import { cn, fmtDate, titleCase } from '../../lib/utils';
import {
  EOP_BUILDER_DISCLAIMER, EOP_BUILDER_VERSION, EOP_SECTIONS, EOP_VARIABLES,
  coveredElementCodes, mergeSampleText, type EopSectionDef
} from '../../data/eopBuilderCatalog';
import type { ComplianceRequirement, EopPlan, Facility, HvaEntry } from '../../types/domain';

// Step-by-step EOP builder: walks the planner through the facility profile,
// one regulation-mapped plan section at a time (pre-filled with starter
// language from the content catalog), then a review step that shows CMS /
// Joint Commission coverage and publishes the assembled plan to the library.

type Step =
  | { type: 'profile' }
  | { type: 'section'; section: EopSectionDef }
  | { type: 'review' };

const STEPS: Step[] = [
  { type: 'profile' },
  ...EOP_SECTIONS.map((section) => ({ type: 'section' as const, section })),
  { type: 'review' }
];

function stepLabel(step: Step): string {
  if (step.type === 'profile') return 'Facility Profile';
  if (step.type === 'review') return 'Review & Publish';
  return step.section.title;
}

// Same Kaiser-style scoring as HvaPage so the inserted summary matches.
function relativeRisk(entry: HvaEntry): number {
  const severity =
    (entry.human_impact + entry.property_impact + entry.business_impact + entry.preparedness + entry.internal_response + entry.external_response) / 6;
  return Math.round((entry.probability / 3) * (severity / 3) * 1000) / 10;
}

function doneCount(plan: EopPlan): number {
  return EOP_SECTIONS.filter((s) => plan.sections?.[s.key]?.done).length;
}

function assembleSections(plan: EopPlan): Array<{ heading: string; body: string }> {
  return EOP_SECTIONS.flatMap((section, i) => {
    const content = plan.sections?.[section.key]?.content?.trim();
    if (!content) return [];
    return [{ heading: `${i + 1}. ${section.title}`, body: content }];
  });
}

function assemblePlanText(plan: EopPlan): string {
  const header = `${plan.title}\nBuilt with the EOP Plan Builder (content library ${EOP_BUILDER_VERSION})\n\n${EOP_BUILDER_DISCLAIMER}`;
  const body = assembleSections(plan)
    .map((s) => `${s.heading.toUpperCase()}\n${'-'.repeat(Math.min(s.heading.length, 72))}\n${s.body}`)
    .join('\n\n\n');
  return `${header}\n\n\n${body}`;
}

export function PlanBuilderPage() {
  const { rows: plans, reload } = useRecords<EopPlan>('eop_plans', { orderBy: 'updated_at', ascending: false });
  const { rows: facilities } = useRecords<Facility>('facilities', {});
  const [activePlan, setActivePlan] = useState<EopPlan | null>(null);

  const startPlan = async () => {
    const facility = facilities.find((f) => f.is_primary) ?? facilities[0];
    const variables: Record<string, string> = {};
    for (const def of EOP_VARIABLES) {
      if (def.defaultValue) variables[def.key] = def.defaultValue;
    }
    if (facility) {
      variables.facility_name = facility.name;
      if (facility.facility_type) variables.facility_type = facility.facility_type;
      if (facility.city && facility.state) variables.city_state = `${facility.city}, ${facility.state}`;
      if (facility.licensed_beds) variables.licensed_beds = String(facility.licensed_beds);
    }
    const saved = await saveRecord('eop_plans', {
      facility_id: facility?.id ?? null,
      title: `Emergency Operations Plan ${new Date().getFullYear()}`,
      status: 'in_progress',
      catalog_version: EOP_BUILDER_VERSION,
      variables,
      sections: {},
      current_step: 0,
      plan_document_id: null
    } as Record<string, unknown>);
    setActivePlan(saved as unknown as EopPlan);
  };

  if (activePlan) {
    return (
      <PlanBuilder
        key={activePlan.id}
        plan={activePlan}
        onExit={async () => {
          setActivePlan(null);
          await reload();
        }}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="EOP Plan Builder"
        subtitle="Build an Emergency Operations Plan step by step from starter language mapped to the CMS EP Rule (42 CFR 482.15) and Joint Commission EM standards"
        actions={<Button onClick={() => void startPlan()}><Plus size={16} /> Start New Plan</Button>}
      />

      <p className="mb-4 rounded-lg border border-slate-700 bg-slate-800/60 p-3 text-xs text-slate-400">{EOP_BUILDER_DISCLAIMER}</p>

      {plans.length === 0 ? (
        <EmptyState
          title="No plans in progress"
          hint="Start a new plan to work through each required section with pre-drafted, regulation-mapped language you can edit as you go."
          action={<Button onClick={() => void startPlan()}><Plus size={16} /> Start New Plan</Button>}
        />
      ) : (
        <DataTable head={['Title', 'Sections Complete', 'Status', 'Updated', '']}>
          {plans.map((plan) => (
            <tr key={plan.id} className="hover:bg-slate-800/70">
              <td className="px-4 py-3 text-sm font-medium">{plan.title}</td>
              <td className="px-4 py-3 text-sm text-slate-400">{doneCount(plan)} / {EOP_SECTIONS.length}</td>
              <td className="px-4 py-3"><Badge tone={plan.status === 'published' ? 'green' : 'yellow'}>{titleCase(plan.status)}</Badge></td>
              <td className="px-4 py-3 text-sm text-slate-400">{fmtDate(plan.updated_at)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button className="text-sm text-brand-400 hover:text-brand-300" onClick={() => setActivePlan(plan)}>
                    {plan.status === 'published' ? 'Open' : 'Resume'}
                  </button>
                  <button
                    className="text-sm text-slate-500 hover:text-red-300"
                    onClick={() => {
                      if (window.confirm(`Delete "${plan.title}"? The draft cannot be recovered.`)) {
                        void deleteRecord('eop_plans', plan.id).then(reload);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}

function PlanBuilder({ plan, onExit }: { plan: EopPlan; onExit: () => void }) {
  const navigate = useNavigate();
  const { rows: requirements } = useRecords<ComplianceRequirement>('compliance_requirements', { orderBy: 'sort_order' });
  const { rows: hazards } = useRecords<HvaEntry>('hva_entries', {});

  const [draft, setDraft] = useState<EopPlan>({
    ...plan,
    variables: plan.variables ?? {},
    sections: plan.sections ?? {}
  });
  const [step, setStep] = useState(() => Math.min(Math.max(plan.current_step ?? 0, 0), STEPS.length - 1));
  const [publishOpen, setPublishOpen] = useState(false);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const timerRef = useRef<number | null>(null);

  const persistNow = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    void saveRecord('eop_plans', draftRef.current as unknown as Record<string, unknown>);
  };

  const update = (mutate: (d: EopPlan) => EopPlan) => {
    setDraft((prev) => mutate(prev));
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(persistNow, 800);
  };

  // Flush any pending autosave when the builder unmounts.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        void saveRecord('eop_plans', draftRef.current as unknown as Record<string, unknown>);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reqByCode = useMemo(() => new Map(requirements.map((r) => [r.element_code, r])), [requirements]);

  const goToStep = (target: number) => {
    const next = Math.min(Math.max(target, 0), STEPS.length - 1);
    const stepDef = STEPS[next];
    update((d) => {
      let sections = d.sections;
      // First visit to a section: seed it with the merged sample text.
      if (stepDef.type === 'section' && sections[stepDef.section.key] === undefined) {
        sections = {
          ...sections,
          [stepDef.section.key]: { content: mergeSampleText(stepDef.section.sampleText, d.variables), done: false }
        };
      }
      return { ...d, sections, current_step: next };
    });
    setStep(next);
    window.scrollTo({ top: 0 });
  };

  const setSection = (key: string, patch: Partial<{ content: string; done: boolean }>) => {
    update((d) => ({
      ...d,
      sections: { ...d.sections, [key]: { content: '', done: false, ...d.sections[key], ...patch } }
    }));
  };

  const hazardSummary = useMemo(() => {
    const scored = hazards
      .filter((h) => h.probability > 0)
      .map((h) => ({ h, score: relativeRisk(h) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    if (!scored.length) return '';
    const lines = scored.map(
      ({ h, score }, i) => `${i + 1}. ${h.hazard_name} (${titleCase(h.hazard_category)}) — relative risk ${score}% — response strategy: [annex / incident response guide]`
    );
    const year = Math.max(...scored.map(({ h }) => h.assessment_year || 0)) || new Date().getFullYear();
    return `Priority hazards from the ${year} Hazard Vulnerability Analysis:\n${lines.join('\n')}`;
  }, [hazards]);

  const insertHvaSummary = (section: EopSectionDef) => {
    const current = draft.sections[section.key]?.content ?? '';
    const placeholder = /\[Insert the prioritized hazard list[^\]]*\]/;
    const next = placeholder.test(current) ? current.replace(placeholder, hazardSummary) : `${current.trimEnd()}\n\n${hazardSummary}\n`;
    setSection(section.key, { content: next });
  };

  const completedKeys = EOP_SECTIONS.filter((s) => draft.sections[s.key]?.done).map((s) => s.key);
  const covered = coveredElementCodes(completedKeys);
  const done = completedKeys.length;
  const current = STEPS[step];

  const requirementChips = (section: EopSectionDef) => (
    <div className="flex flex-wrap gap-1.5">
      {section.cmsRefs.map((code) => {
        const req = reqByCode.get(code);
        return (
          <span key={code} title={req ? `${req.title} — ${req.description}` : code}>
            <Badge tone="blue">CMS {req?.reference_code ?? code}</Badge>
          </span>
        );
      })}
      {section.tjcRefs.map((code) => {
        const req = reqByCode.get(code);
        return (
          <span key={code} title={req ? `${req.title} — ${req.description}` : code}>
            <Badge tone="purple">TJC {req?.reference_code ?? code}</Badge>
          </span>
        );
      })}
    </div>
  );

  return (
    <div>
      <PageHeader
        title={draft.title}
        subtitle={`EOP Plan Builder · Step ${step + 1} of ${STEPS.length} · ${done}/${EOP_SECTIONS.length} sections complete`}
        actions={
          <Button variant="secondary" onClick={() => { persistNow(); onExit(); }}>
            <ArrowLeft size={16} /> All Plans
          </Button>
        }
      />

      {/* Mobile step jumper */}
      <div className="mb-4 lg:hidden">
        <Select value={step} onChange={(e) => goToStep(Number(e.target.value))}>
          {STEPS.map((s, i) => (
            <option key={i} value={i}>{i + 1}. {stepLabel(s)}</option>
          ))}
        </Select>
      </div>

      <div className="flex gap-6">
        {/* Step navigator */}
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-20 space-y-1 rounded-xl border border-slate-700 bg-slate-800/60 p-2">
            {STEPS.map((s, i) => {
              const isDone = s.type === 'section' && draft.sections[s.section.key]?.done;
              const visited = s.type === 'section' && draft.sections[s.section.key] !== undefined;
              return (
                <button
                  key={i}
                  onClick={() => goToStep(i)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    i === step ? 'bg-brand-600/20 text-brand-300' : 'text-slate-300 hover:bg-slate-700/60'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
                      isDone ? 'border-emerald-600 bg-emerald-600/20 text-emerald-300' : visited || s.type !== 'section' ? 'border-slate-500 text-slate-300' : 'border-slate-600 text-slate-500'
                    )}
                  >
                    {isDone ? <Check size={12} /> : i + 1}
                  </span>
                  <span className="min-w-0 truncate">{stepLabel(s)}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Step body */}
        <div className="min-w-0 flex-1 space-y-4">
          {current.type === 'profile' && (
            <Card
              title="Facility Profile"
              subtitle="These details are merged into the sample text for every section. Anything left blank appears as a [bracketed placeholder] to fill in later."
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {EOP_VARIABLES.map((def) => (
                  <Field key={def.key} label={def.label}>
                    <Input
                      value={draft.variables[def.key] ?? ''}
                      placeholder={def.help ?? def.placeholder}
                      onChange={(e) => update((d) => ({ ...d, variables: { ...d.variables, [def.key]: e.target.value } }))}
                    />
                  </Field>
                ))}
                <Field label="Plan Title" span={2}>
                  <Input value={draft.title} onChange={(e) => update((d) => ({ ...d, title: e.target.value }))} />
                </Field>
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Sections you have not opened yet pick up these values automatically. Sections already drafted keep their text — use “Reset to sample text” inside a section to re-merge.
              </p>
              <div className="mt-4 flex justify-end">
                <Button onClick={() => goToStep(step + 1)}>Begin Plan <ArrowRight size={16} /></Button>
              </div>
            </Card>
          )}

          {current.type === 'section' && (
            <>
              <Card title={current.section.title} subtitle={current.section.purpose}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  {requirementChips(current.section)}
                  <div className="flex gap-2">
                    {current.section.key === 'hva' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!hazardSummary}
                        title={hazardSummary ? 'Insert your top-scored hazards from the HVA module' : 'No scored hazards found in the HVA module'}
                        onClick={() => insertHvaSummary(current.section)}
                      >
                        <ListPlus size={14} /> Insert HVA hazard summary
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (window.confirm('Replace this section with the original sample text? Your edits to this section will be lost.')) {
                          setSection(current.section.key, {
                            content: mergeSampleText(current.section.sampleText, draft.variables),
                            done: false
                          });
                        }
                      }}
                    >
                      <RotateCcw size={14} /> Reset to sample text
                    </Button>
                  </div>
                </div>

                <Textarea
                  className="min-h-[440px] whitespace-pre-wrap text-[13px] leading-relaxed"
                  value={draft.sections[current.section.key]?.content ?? ''}
                  onChange={(e) => setSection(current.section.key, { content: e.target.value })}
                />

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <Button variant="secondary" onClick={() => goToStep(step - 1)}><ArrowLeft size={16} /> Back</Button>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => goToStep(step + 1)}>Skip for now</Button>
                    <Button
                      variant="success"
                      onClick={() => {
                        setSection(current.section.key, { done: true });
                        goToStep(step + 1);
                      }}
                    >
                      <Check size={16} /> Mark Complete & Continue
                    </Button>
                  </div>
                </div>
              </Card>

              <Card title="Before you move on" subtitle="What surveyors look for in this section — tailor the sample text accordingly">
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-300">
                  {current.section.considerations.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </Card>
            </>
          )}

          {current.type === 'review' && (
            <ReviewStep
              draft={draft}
              requirements={requirements}
              covered={covered}
              done={done}
              onBack={() => goToStep(step - 1)}
              onJump={(sectionKey) => goToStep(1 + EOP_SECTIONS.findIndex((s) => s.key === sectionKey))}
              onPublish={() => setPublishOpen(true)}
            />
          )}
        </div>
      </div>

      <PublishModal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        draft={draft}
        requirements={requirements}
        covered={covered}
        onPublished={(planDocumentId) => {
          update((d) => ({ ...d, status: 'published', plan_document_id: planDocumentId }));
          setPublishOpen(false);
          window.setTimeout(() => navigate('/preparedness/plans'), 400);
        }}
      />
    </div>
  );
}

function ReviewStep({ draft, requirements, covered, done, onBack, onJump, onPublish }: {
  draft: EopPlan;
  requirements: ComplianceRequirement[];
  covered: { cms: Set<string>; tjc: Set<string> };
  done: number;
  onBack: () => void;
  onJump: (sectionKey: string) => void;
  onPublish: () => void;
}) {
  const frameworks: Array<{ key: 'cms' | 'tjc'; label: string; set: Set<string> }> = [
    { key: 'cms', label: 'CMS EP Rule (42 CFR 482.15)', set: covered.cms },
    { key: 'tjc', label: 'Joint Commission EM', set: covered.tjc }
  ];

  const sectionsForCode = (code: string) =>
    EOP_SECTIONS.filter((s) => s.cmsRefs.includes(code) || s.tjcRefs.includes(code));

  const exportPdf = () => {
    exportDocumentPdf(
      {
        title: draft.title,
        subtitle: `${draft.variables.facility_name || '[Facility Name]'} · Draft assembled from the EOP Plan Builder`,
        footnote: EOP_BUILDER_DISCLAIMER
      },
      assembleSections(draft),
      `${draft.title.replace(/\s+/g, '-')}.pdf`
    );
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sections Complete" value={`${done}/${EOP_SECTIONS.length}`} tone={done === EOP_SECTIONS.length ? 'green' : 'yellow'} />
        <StatCard label="CMS Elements Addressed" value={`${covered.cms.size}`} hint="of the seeded element library" tone={covered.cms.size ? 'green' : 'slate'} />
        <StatCard label="TJC Elements Addressed" value={`${covered.tjc.size}`} hint="of the seeded element library" tone={covered.tjc.size ? 'green' : 'slate'} />
        <StatCard label="Content Library" value={EOP_BUILDER_VERSION} />
      </div>

      {frameworks.map(({ key, label, set }) => {
        const reqs = requirements.filter((r) => r.framework === key);
        if (!reqs.length) return null;
        const missing = reqs.filter((r) => !set.has(r.element_code));
        return (
          <Card
            key={key}
            title={`${label} coverage`}
            subtitle={`${reqs.length - missing.length} of ${reqs.length} elements addressed by completed sections`}
          >
            {missing.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 size={16} /> Every element in this library is addressed by a completed section.</p>
            ) : (
              <div className="space-y-2">
                {missing.map((req) => {
                  const owners = sectionsForCode(req.element_code);
                  return (
                    <div key={req.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-800 p-3">
                      <p className="min-w-0 flex-1 text-sm text-slate-300">
                        <span className="mr-2 text-xs font-semibold text-brand-400">{req.reference_code} · {req.element_code}</span>
                        {req.title}
                      </p>
                      {owners.length > 0 ? (
                        owners.map((s) => (
                          <button key={s.key} onClick={() => onJump(s.key)} className="text-xs text-brand-400 hover:text-brand-300">
                            Complete “{s.title}” →
                          </button>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">Not covered by a builder section — assess separately in Compliance.</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}

      <Card title="Assembled Plan Preview" subtitle="Everything below is editable — jump back to any section, or edit later in the EOP & Plan Library after publishing">
        <div className="max-h-[480px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-700 bg-slate-900 p-4 text-[13px] leading-relaxed text-slate-300">
          {assemblePlanText(draft)}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Button variant="secondary" onClick={onBack}><ArrowLeft size={16} /> Back</Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={exportPdf}><Download size={16} /> Export PDF</Button>
            <Button onClick={onPublish}><Check size={16} /> Publish to Plan Library</Button>
          </div>
        </div>
      </Card>
    </>
  );
}

function PublishModal({ open, onClose, draft, requirements, covered, onPublished }: {
  open: boolean;
  onClose: () => void;
  draft: EopPlan;
  requirements: ComplianceRequirement[];
  covered: { cms: Set<string>; tjc: Set<string> };
  onPublished: (planDocumentId: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const defaultReview = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 2);
    return d.toISOString().slice(0, 10);
  })();

  const [version, setVersion] = useState('1.0');
  const [owner, setOwner] = useState('');
  const [effective, setEffective] = useState(today);
  const [nextReview, setNextReview] = useState(defaultReview);
  const [attachEvidence, setAttachEvidence] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const addressedReqs = requirements.filter(
    (r) => (r.framework === 'cms' && covered.cms.has(r.element_code)) || (r.framework === 'tjc' && covered.tjc.has(r.element_code))
  );

  const publish = async (e: FormEvent) => {
    e.preventDefault();
    setPublishing(true);
    try {
      const docRow = await saveRecord('plan_documents', {
        title: draft.title,
        doc_type: 'eop',
        version,
        status: 'draft',
        content: assemblePlanText(draft),
        effective_date: effective || null,
        next_review_date: nextReview || null,
        owner_name: owner,
        storage_path: ''
      } as Record<string, unknown>);

      if (attachEvidence) {
        const sectionTitlesFor = (req: ComplianceRequirement) =>
          EOP_SECTIONS.filter((s) => s.cmsRefs.includes(req.element_code) || s.tjcRefs.includes(req.element_code))
            .map((s) => s.title)
            .join('; ');
        for (const req of addressedReqs) {
          await saveRecord('compliance_evidence', {
            requirement_id: req.id,
            evidence_type: 'document',
            title: `${draft.title} v${version}`,
            description: `Addressed in EOP section(s): ${sectionTitlesFor(req)}. Published from the EOP Plan Builder.`,
            evidence_date: today,
            storage_path: '',
            exercise_id: null
          } as Record<string, unknown>);
        }
      }

      onPublished(String(docRow.id));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Publish to EOP & Plan Library">
      <form onSubmit={publish} className="space-y-4">
        <p className="text-sm text-slate-400">
          Creates a versioned document in the EOP & Plan Library (status <span className="text-slate-200">Draft</span>) where it can be edited, routed for approval, and tracked on its review cycle.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Version">
            <Input value={version} onChange={(e) => setVersion(e.target.value)} />
          </Field>
          <Field label="Plan Owner">
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="e.g., Emergency Management Coordinator" />
          </Field>
          <Field label="Effective Date">
            <Input type="date" value={effective} onChange={(e) => setEffective(e.target.value)} />
          </Field>
          <Field label="Next Review Date">
            <Input type="date" value={nextReview} onChange={(e) => setNextReview(e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-slate-500">
          CMS requires review at least every 2 years; set an earlier date if your facility or state follows an annual cycle.
        </p>
        <label className="flex items-start gap-2 rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={attachEvidence}
            onChange={(e) => setAttachEvidence(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900"
          />
          <span>
            Attach this plan as evidence to the <span className="font-semibold text-slate-100">{addressedReqs.length}</span> compliance elements it addresses, so the Compliance binder links each element to the plan.
          </span>
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={publishing}>{publishing ? 'Publishing…' : 'Publish Plan'}</Button>
        </div>
      </form>
    </Modal>
  );
}
