"use client";

import { useRouter } from "next/navigation";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { getProjects } from "@/lib/api";
import type { Project } from "@/types/project";

import styles from "./CommandPalette.module.css";

interface PaletteItem {
  id: string;
  group: string;
  label: string;
  hint: string;
  href: string;
  search: string;
}

function page(
  label: string,
  href: string,
  keywords = "",
): PaletteItem {
  return {
    id: `page:${href}`,
    group: "Go to",
    label,
    hint: href,
    href,
    search: `${label} ${keywords}`.toLowerCase(),
  };
}

const PAGES: PaletteItem[] = [
  page("Portfolio overview", "/", "home dashboard"),
  page("Portfolio health", "/portfolio", "executive"),
  page("Portfolio forecast", "/portfolio/forecast", "evm cost"),
  page("Portfolio governance", "/portfolio/governance", "actions decisions"),
  page("Portfolio recovery", "/portfolio/recovery", "change impact"),
  page("Portfolio period control", "/portfolio/period-control", "baseline"),
  page("Portfolio control tower", "/portfolio/tower", "matrix heatmap lenses red projects exceptions suppliers cpi spi"),
  page("Portfolio data pack", "/portfolio/export", "csv excel download zip power bi projects table"),
  page("Executive report", "/portfolio/report", "print pdf summary export"),
  page("Compare projects", "/portfolio/compare", "radar benchmark side by side"),
  page("Projects", "/projects"),
  page("Budgets", "/budgets", "cost"),
  page("Work packages", "/work-packages", "production"),
  page("Procurement", "/procurement", "suppliers"),
  page("Risks", "/risks", "issues"),
  page("Documents", "/documents", "rfi transmittal"),
  page("Intelligence", "/intelligence", "ai"),
];

const SECTIONS: ReadonlyArray<readonly [string, string, string]> = [
  ["", "Command center", "overview health"],
  ["map", "Project map", "all modules boards links navigate areas index overview where to go health score tiles"],
  ["find", "Find anything", "search find lookup locate record reference number watchlist watch pin follow status change anything everything"],
  ["inbox", "Action inbox", "overdue due open actions rfi ncr mitigation decisions owner todo what to do"],
  ["watchlist", "My watchlist", "watchlist watch list pinned pin follow keep an eye on my items favourites bookmarks tracking changed overdue closed since pinned"],
  ["whats-new", "Since my last visit", "since my last visit what changed whats new new changed closed newly overdue catch up snapshot diff"],
  ["backlog", "Backlog trend", "backlog trend open items burn down burndown raised closed net pace clearing how long snags ncrs rfis actions shrinking growing weekly"],
  ["closure-speed", "Closure speed", "closure speed time to close how long to close median days turnaround resolution time on time late closing stuck slowest aged open items snags ncrs rfis observations safety actions meeting actions pace faster slower"],
  ["owner-reliability", "Owner reliability", "owner reliability who delivers on time dependable late owners on time record people companies performance accountability overdue by owner trades consultants subcontractors responsiveness"],
  ["pareto", "Pareto analysis", "pareto analysis 80 20 vital few root causes ncr categories trades snags incident types hazards delay causes change originators biggest causes where to focus"],
  ["calendar", "Due-date calendar", "calendar due dates deadlines month agenda ics download overdue this week schedule of items"],
  ["site-brief", "Site brief", "site brief daily huddle toolbox talk permits inspections deliveries blocked work today print morning briefing"],
  ["workload", "Workload", "workload people owners who assigned chase overloaded unassigned no owner capacity load team"],
  ["scorecard", "Health radar", "scorecard radar health scores weakest modules overview"],
  ["targets", "Targets", "targets kpi goals thresholds traffic lights met missed close performance targets track against target how are we doing against targets trend history service levels"],
  ["costs", "Cost control", "budget commitments actuals"],
  ["spend-board", "Spend board", "monthly spend run rate vendors commitments unbilled purchase orders invoices budget categories"],
  ["budget-movement", "Budget movement", "budget movement original budget approved changes revised budget budget growth cost plan changes budget bridge original plan to revised forecast over revised budget lines grown unbudgeted forecast budget creep cost plan drift budget lines changed"],
  ["schedule", "Schedule", "critical path activities lookahead"],
  ["lookahead", "Lookahead board", "six week lookahead gantt float constraints critical path baseline finish"],
  ["milestone-board", "Milestone board", "milestones planned forecast slip late dates completion handover finish weight behind plan"],
  ["timeline", "Timeline (Gantt)", "gantt chart bars critical path dependencies"],
  ["forecast", "Forecast", "evm cpi spi scenarios"],
  ["scenarios", "Scenario board", "what if scenarios cost range finish range assumptions cpi spi tcpi eac forecast"],
  ["finish-simulation", "Finish confidence", "finish date confidence monte carlo simulation probability p50 p80 p90 uncertainty schedule risk chance on time critical path forecast range"],
  ["slip-explorer", "Slip explorer", "slip explorer what if delay activity slips float impact finish date knock on ripple critical path sensitivity overrun late start"],
  ["logic-map", "Logic map", "logic map network diagram dependencies links predecessors successors critical path float driving relationships precedence chain waits on holds up schedule logic"],
  ["start-readiness", "Start readiness", "start readiness make ready ready to start blocked activities predecessors constraints not started should have started late start what is holding up readiness check next activities unblock"],
  ["constraint-log", "Constraint log", "constraint log constraints open constraints how long constraints take to clear age of constraints clearing time past due constraints blockers on critical path who is holding constraints design information permits access approvals waiting time"],
  ["schedule-health", "Schedule health", "schedule health quality audit check dcma 14 point logic links open ends loose ends float negative float lags leads constraints data date stale trust"],
  ["pinch-points", "Pinch points", "pinch points float total float no float critical near critical tight weeks when is the schedule tight float by trade next to go critical negative float slack squeeze peak criticality"],
  ["progress-curve", "Progress curve", "progress curve s-curve s curve planned vs actual percent complete behind plan ahead of plan discipline progress expected progress schedule performance where are we against schedule"],
  ["progress-agreement", "Programme vs site progress", "programme vs site progress schedule progress work package progress programme progress site progress agree activities linked work packages unlinked activities programme ahead site ahead status mismatch start dates differ finish dates differ percent complete mismatch"],
  ["forecast-drift", "Forecast drift", "forecast drift eac creep estimate at completion movement forecast finish moving forecast stability forecast changes snapshots cost forecast creeping finish date slipping forecast history forecast trend cost estimate change finish forecast change cpi spi history"],
  ["since-report", "Since last report", "since last report snapshot compare changed better worse executive report then now"],
  ["activity", "Activity timeline", "activity timeline what happened recently latest changes digest history log quiet modules weekly update news"],
  ["trends", "Trends (S-curve)", "evm s-curve cpi spi history chart snapshots"],
  ["board", "Action board", "kanban governance actions drag status"],
  ["cost-breakdown", "Cost breakdown", "drill down categories cost codes commitments actuals"],
  ["risk-control", "Risk control", "risks issues changes delays"],
  ["risk-board", "Risk board", "exposure before after mitigations due delay causes change decisions waiting"],
  ["risk-matrix", "Risk matrix", "heatmap probability impact residual inherent"],
  ["risk-materialisation", "Risk materialisation", "risk materialisation risks that happened risks became issues issues not on the risk register unforeseen issues risk register accuracy risk ratings calibration risk to issue risk realised mitigation late issue source risk register hit rate unregistered issues"],
  ["issue-ageing", "Issue ageing", "issue ageing open issues age overdue issues past target issues not started issues issues without owner no target date target before raised oldest issues issue backlog unowned issues critical issues waiting"],
  ["risk-register-checks", "Risk register checks", "risk register checks risk register quality risk scores wrong residual higher than inherent band mismatch risk owner missing mitigation plan missing mitigation overdue stale risks accepted high risk duplicate risk reference register consistency risk data quality"],
  ["procurement", "Procurement", "packages bids suppliers"],
  ["supplier-board", "Supplier board", "suppliers subcontractors vendors performance scores evaluations trend qualification award concentration league warnings"],
  ["award-choices", "Award choices", "award choices lowest bid awarded above lowest bid tender outcomes winning bid bid spread single bid awards premium paid over lowest bid bid scores best value award procurement awards negotiated price tender analysis bid comparison"],
  ["procurement-pipeline", "Procurement pipeline", "packages bids lead time float award timeline suppliers scorecard"],
  ["production", "Production", "work packages site reports"],
  ["production-board", "Production board", "plan actual progress productivity blocked site reports weather labour hours"],
  ["report-lag", "Report filing lag", "report filing lag site report lag late site reports reports written up late draft site reports unfiled reports diary lag daily report lateness batch filing reports created late site diary timeliness report timeliness"],
  ["run-rate", "Run rate", "run rate pace production rate output per day required rate forecast finish work package behind schedule productivity quantity remaining will it finish on time site output weekly output slipping packages stalled no output catch up"],
  ["production-checks", "Production reconciliation", "production reconciliation daily entries package totals do entries add up site report entries quantity labour hours equipment hours totals mismatch draft reports entry checks output with no hours long shift duplicate entries unit mismatch entries outside package dates"],
  ["weather-record", "Weather record", "weather record adverse weather rain days wind heat cold weather delay extension of time eot claim weather days lost site reports weather log inclement weather lost working days weather evidence"],
  ["diary-evidence", "Site diary evidence", "diary evidence site diary quality daily report notes empty notes thin notes copied notes copy paste reports weather mismatch unlogged delay delay not in diary report evidence delay documentation site diary audit"],
  ["quality", "Quality", "inspections ncr punch handover"],
  ["quality-board", "Quality board", "ncr ageing defects inspections punch burndown handover"],
  ["inspection-schedule", "Inspection schedule", "inspection schedule overdue inspections planned inspections third party inspections client consultant regulatory inspection hold point itp inspection punctuality inspection look ahead quality inspections due late inspections inspection calendar test schedule"],
  ["inspection-outcomes", "Inspection outcomes", "inspection outcomes first time pass rate failed inspections fail rate inspection results pass with observations ncr follow up re-inspection reinspection failed inspection no ncr third party fail rate quality pass rate rework inspection pass fail"],
  ["handover-timeliness", "Handover timeliness", "handover timeliness handover documents late handover items handover due dates o and m manuals as built drawings overdue handover warranty documents missing handover rejected handover items approval time handover dates wrong closeout documents received late handover owners"],
  ["ncr-records", "NCR closure records", "ncr closure records closed ncrs documentation root cause corrective action verification closed without root cause closed without verification non conformance report records incomplete ncr paperwork critical ncr closed with gap ncr owners closing quality records"],
  ["closeout-board", "Closeout board", "closeout handover readiness completion checklist gates snagging punch ncr handover pack practical completion blockers"],
  ["safety", "Safety", "hse incidents permits"],
  ["safety-board", "Safety board", "incidents trend hazards permits expiry actions overdue recordable"],
  ["safety-rates", "Safety rates", "safety rates trir ltifr recordable rate lost time injury frequency rate incident rate per 200000 hours severity rate near miss ratio days since last recordable accident rate hours worked injuries per hour safety statistics"],
  ["safety-follow-up", "Safety follow-up", "safety follow up corrective actions incidents without actions unsafe observations without actions hazards with no action overdue safety actions closed without action action coverage time to first action actions not verified closed with open action follow through hse actions"],
  ["incident-investigations", "Incident investigations", "incident investigations incident reporting late incident reports reported late closed without root cause no root cause no investigation notes incidents open too long incident follow through investigation quality serious incidents incident paperwork near miss reporting delay lost time incident records immediate action recorded"],
  ["observation-culture", "Observation culture", "observation culture safety observations who observes positive observations share of positive observers one observer quiet weeks weeks without observations recurring hazards hazard categories rising unsafe acts unsafe conditions safe acts good practice observation programme"],
  ["permit-overlaps", "Permit overlaps", "permit overlaps permit to work clash hot work confined space work at height lifting excavation simultaneous permits concurrent permits ptw conflicts expired permits permit coordination permits in force simultaneous operations simops"],
  ["permit-discipline", "Permit discipline", "permit discipline permits closed late permits open past expiry expired permits still open permits without controls permit controls missing issuer receiver location permit paperwork permit to work closure ptw closed on time long permits high risk permits permit receivers hot work permit controls"],
  ["hotspots", "Site hotspots", "hotspots locations heat map where snags punch permits incidents unsafe observations area level block site walk trouble"],
  ["commercial", "Commercial", "claims payments cashflow"],
  ["commercial-board", "Commercial board", "receivables ageing retention change orders claims yield overdue payments certificates"],
  ["valuation-gap", "Valuation gap", "valuation gap change order recovery claim recovery assessed value claimed amount awarded amount approved in full amount asked amount decided change order outcomes claim outcomes extension of time awarded days claimed days money claimed recovery rate rejected claims partially approved claims waiting for decision commercial recovery"],
  ["certificate-checks", "Certificate checks", "certificate checks payment certificates ipc period gap overlap certificate periods net certified retention mismatch paid plus outstanding overpaid certified above applied status mismatch duplicate certificate reference retention rate"],
  ["cash-position", "Cash position", "cash position cash flow cashflow running total net cash inflow outflow shortfall cash gap forecast against plan receivables certified but unpaid retention funding requirement lowest cash peak funding monthly cash"],
  ["entitlement-board", "Entitlement board", "entitlement unpriced change events change orders claims time extension awarded delay days money owed"],
  ["delay-concurrency", "Delay concurrency", "delay concurrency overlapping delays concurrent delays delay overlap double counted delay days excusable and non excusable overlap delay timeline delay calendar delays running at once delay windows concurrent days delay analysis cause overlap"],
  ["decision-times", "Decision times", "decision times turnaround how long change orders take claims decisions certification payment applications paid late payment waiting for decisions overdue approvals pending change orders pending claims decided by due date payment delays speed of approval"],
  ["cashflow", "Cashflow", "cash flow inflow outflow chart payment ageing certificates"],
  ["resources", "Resources", "workforce equipment"],
  ["idle-plant", "Idle plant", "idle plant equipment idle cost downtime utilisation utilization off hire candidates hired plant rented equipment breakdowns machines cranes excavators plant cost wasted hire cost under used equipment"],
  ["fatigue-watch", "Fatigue watch", "fatigue watch long hours overtime rest days consecutive days no day off working too long hours per worker crew fatigue seven day week tired workers working time long days 12 hour days run of days"],
  ["labour-reconciliation", "Labour reconciliation", "labour reconciliation labor reconciliation deployed hours reported hours timesheets vs site reports man hours booked unbooked labour work package hours manpower reconciliation payroll hours labour variance crew hours not booked ghost hours"],
  ["plant-reconciliation", "Plant reconciliation", "plant reconciliation equipment reconciliation equipment usage log usage vs site reports equipment hours operating hours machine hours plant hours booked plant hours not reported usage log errors hours do not add up utilisation mismatch duplicate usage records equipment not on register unreported plant days"],
  ["labour-burn", "Labour budget burn", "labour burn labour budget burn hours used labour hours overrun labour overrun man hours earned hours labour efficiency work package hours forecast hours at completion labour forecast hours budget productivity overspend labour hours"],
  ["crew-plan", "Crew size against plan", "crew size against plan crew size planned headcount planned workers workers on site headcount against plan short crews crews short of plan crew never on site workforce plan attendance trade crews planned crew worker days labour shortfall manning plan manpower plan"],
  ["trade-flow", "Trade flow", "trade flow trades on site week by week crowding congestion peak week manpower histogram labour loading disciplines remobilisation idle gaps trades leave and return resource loading by discipline heatmap of activities busiest week"],
  ["trade-sheet", "Trade sheet", "trade sheet weekly work plan foreman look ahead print sheet per trade discipline plan next two weeks crew work list ready to start constraints for trade subcontractor weekly plan committed tasks"],
  ["resource-heatmap", "Resource heatmap", "labour labor equipment utilisation idle overtime shortage productivity"],
  ["documents", "Documents", "rfi transmittal drawings"],
  ["rfi-board", "RFI board", "rfi response time ageing assignee overdue register transmittals drawings"],
  ["transmittal-coverage", "Transmittal coverage", "transmittal coverage revisions not sent unsent revisions issued drawings not transmitted draft transmittals document issue transmittal log not sent to client document control distribution issued but not sent transmittal turnaround recipients"],
  ["document-board", "Document board", "documents drawings revisions status review stuck draft rework duplicates checksum text scanned discipline issue rate"],
  ["governance", "Governance", "meetings decisions actions"],
  ["governance-board", "Governance board", "actions owners overdue decisions pending meetings minutes workload due dates"],
  ["meeting-cadence", "Meeting cadence", "meeting cadence meeting rhythm lapsed meetings meetings not held meeting frequency regular meetings progress meeting weekly meeting recurring meetings missed meetings meetings not recorded meeting schedule slipping meetings governance cadence"],
  ["meeting-outputs", "Meeting outputs", "meeting outputs meeting results meetings with no actions decisions per meeting actions per meeting actions completed from meetings meeting follow up open actions age overdue meeting actions meetings that produce nothing minutes outputs meeting effectiveness action closure by meeting type"],
  ["meeting-pack", "Meeting pack", "meeting pack weekly agenda minutes chair attendees print pdf markdown progress meeting report"],
  ["recovery", "Recovery", "change impact simulation"],
  ["recovery-board", "Recovery board", "change impact waterfall recovery options cost per day residual delay simulation"],
  ["period-control", "Period control", "baseline period close"],
  ["period-board", "Period board", "period close readiness blockers snapshots baseline drift cpi spi"],
  ["baseline-history", "Baseline history", "baseline history baseline versions re baselining rebaseline baseline reset target moved cost target moved finish target moved original baseline overrun against original baseline forecast against first baseline baseline changes reset reasons left behind variance"],
  ["data-health", "Data hygiene", "data health hygiene quality of data missing owners stale dates gaps completeness audit checks fix list"],
  ["export", "Data export", "csv excel download zip power bi registers spreadsheet"],
  ["copilot", "AI copilot", "ask local ai"],
  ["report", "Project report", "status report print pdf summary"],
];

function projectItems(projects: Project[]): PaletteItem[] {
  return projects.flatMap((project) =>
    SECTIONS.map(([slug, label, keywords]) => ({
      id: `project:${project.id}:${slug}`,
      group: slug === "" ? "Projects" : project.name,
      label: slug === "" ? project.name : label,
      hint: project.code,
      href: slug
        ? `/projects/${project.id}/${slug}`
        : `/projects/${project.id}`,
      search:
        `${project.name} ${project.code} ${project.clientName} ${label} ${keywords}`.toLowerCase(),
    })),
  );
}

export function CommandPalette() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();

        if (open) {
          close();
        } else {
          setOpen(true);
        }
      }
    }

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open || loaded) {
      return;
    }

    let cancelled = false;

    getProjects()
      .then((response) => {
        if (!cancelled) {
          setProjects(response);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  const projectEntries = useMemo(
    () => projectItems(projects),
    [projects],
  );

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const all = [...PAGES, ...projectEntries];

    if (!needle) {
      return all
        .filter(
          (item) =>
            item.group === "Go to" || item.id.endsWith(":"),
        )
        .slice(0, 30);
    }

    const tokens = needle.split(/\s+/);

    return all
      .filter((item) =>
        tokens.every((token) => item.search.includes(token)),
      )
      .slice(0, 40);
  }, [query, projectEntries]);

  const index = Math.max(
    0,
    Math.min(active, results.length - 1),
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [index, open, results]);

  function go(item: PaletteItem | undefined) {
    if (!item) {
      return;
    }

    router.push(item.href);
    close();
  }

  function onInputKey(
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[index]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  return (
    <>
      <button
        aria-label="Open command palette"
        className={styles.trigger}
        onClick={() => setOpen(true)}
        type="button"
      >
        <span>Search</span>
        <kbd>⌘K</kbd>
      </button>

      {open && (
        <div
          className={styles.overlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              close();
            }
          }}
          role="presentation"
        >
          <div
            aria-label="Command palette"
            aria-modal="true"
            className={styles.panel}
            role="dialog"
          >
            <input
              aria-label="Search pages and projects"
              className={styles.input}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKey}
              placeholder="Jump to a page, project or section…"
              ref={inputRef}
              value={query}
            />

            <div
              className={styles.list}
              ref={listRef}
              role="listbox"
            >
              {results.length === 0 && (
                <div className={styles.empty}>
                  {loaded ? "No matches" : "Loading projects…"}
                </div>
              )}

              {results.map((item, position) => {
                const showGroup =
                  position === 0 ||
                  results[position - 1].group !== item.group;

                return (
                  <div key={item.id}>
                    {showGroup && (
                      <div className={styles.group}>
                        {item.group}
                      </div>
                    )}

                    <button
                      aria-selected={position === index}
                      className={`${styles.item} ${
                        position === index ? styles.active : ""
                      }`}
                      data-active={position === index}
                      onClick={() => go(item)}
                      onMouseEnter={() => setActive(position)}
                      role="option"
                      type="button"
                    >
                      <span>{item.label}</span>
                      <small>{item.hint}</small>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className={styles.footer}>
              <span>↑↓ navigate</span>
              <span>↵ open</span>
              <span>esc close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
