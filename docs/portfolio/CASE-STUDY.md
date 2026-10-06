# BuildSight: portfolio case study

Everything between square brackets is for you to fill in. Everything else is ready to paste.

## 1. Short copy

**Card title:** BuildSight

**One line (about 120 characters):**
Full-stack project-controls platform that tells construction teams which projects are slipping and what recovery would cost.

**Two sentences:**
BuildSight turns schedule, cost, risk, safety and paperwork data into plain-language answers for construction managers, across a whole portfolio of projects. It is a Spring Boot 4 and Next.js 16 application with more than 80 focused pages, built and checked down to phone width.

**Tags:** Java 25 · Spring Boot 4 · PostgreSQL · Next.js 16 · React 19 · TypeScript · Playwright

**Links:** [Live demo] · [GitHub] · [Demo video]

## 2. CV and LinkedIn bullets

- Designed and built **BuildSight**, a full-stack construction project-controls platform (Java 25, Spring Boot 4, PostgreSQL with Flyway, Next.js 16, React 19, TypeScript) with 126 routes covering portfolio forecasting, recovery planning, governance, document control and risk.
- Modelled recovery planning in the backend: each option's cost is netted against the time-related savings of the days it recovers, then rolled up across the portfolio, and presented in the UI as a clear net cost or net saving.
- Built a Playwright audit that opens every route at desktop and phone width and checks for script errors, failed API calls, `NaN` or `Infinity`, empty default dates, raw backend codes, absurd percentages and sideways scrolling. It found and fixed real defects, and the latest run had no failures across 126 routes.

## 3. The case study

### Overview

BuildSight is a project-controls platform for construction. Site and project managers use it to see, across all their projects, what is slipping, why, and what it would cost to get back on track.

| | |
| --- | --- |
| **Role** | [Solo full-stack developer: product, backend, frontend, quality] |
| **Timeline** | [dates] |
| **Stack** | Java 25, Spring Boot 4.1, PostgreSQL, Flyway, Next.js 16, React 19, TypeScript, CSS Modules, Playwright |
| **Links** | [Live demo] · [GitHub] · [Demo video] |

### The problem

On a construction project the schedule lives in one tool, costs in another, risks in a register, safety in a log and paperwork in a shared drive. They rarely agree, and nobody has time to reconcile them before Monday's meeting. By the time a delay shows up in a report, the cheap ways to recover from it are gone.

### The approach

I built the product around **questions, not charts.** Each page is titled with a question a site manager would really ask, such as "How sure is the finish date?", "Can the risk register be trusted?" or "Do the payment certificates add up?", and opens with two or three sentences on how to read it. That rule shaped the whole product: it keeps each page focused, and it makes the numbers easy to challenge.

Two ideas run through everything:

1. **Show whether the data can be trusted before showing what it says.** A family of pages reconciles one record against another: payment certificates against their own arithmetic, daily production against package totals, deployed crews against reported hours, equipment logs against plant hours.
2. **Never show a number that could mislead.** No `NaN`, no `Infinity`, no 1970 dates, no 137,629% growth, no raw `AT_RISK` codes.

### Key features

*(Use one screenshot per feature. The pictures are in `docs/portfolio/images/`, and the file names match the screenshot script.)*

1. **Portfolio control tower and executive views**: every project through every lens, with portfolio-level forecast, governance, recovery and period control. `portfolio-dashboard.png`, `portfolio-tower.png`
2. **Forecast to recovery plan**: the forecast flags a slipping project, then the recovery page ranks options by cost, days recovered and net recovery cost. `project-forecast.png`, `project-recovery.png`, `portfolio-recovery.png`
3. **"What if" tools**: finish simulation ("How sure is the finish date?"), slip explorer ("What if this activity slips?") and scenarios. `project-scenarios.png`, `project-progress-curve.png`
4. **Governance and meeting pack**: an agenda that is already filled in from the project's own data, plus an executive status report. `project-governance.png`, `project-meeting-pack.png`
5. **Action board**: drag-and-drop columns with screen-reader labels, usable on a phone. `project-board.png`, `project-board-phone.png`
6. **Document control and handover**: revisions, transmittals and handover timeliness. `project-documents.png`
7. **Optional AI assistance**: project and portfolio briefs and an ask-the-project assistant. `project-copilot.png` [include only if it works well in your demo]

### How it is built

- **Backend:** Spring Boot 4.1 on Java 25 exposing a REST API under `/api/v1`. Calculation engines sit in the service layer (for example the change-impact simulation behind the recovery options, and the portfolio roll-ups).
- **Database:** PostgreSQL, with every schema change as a Flyway migration.
- **Frontend:** Next.js 16 App Router with React 19 and TypeScript. CSS Modules keep each page's styles self-contained.
- **Quality:** a Playwright audit plus the TypeScript type check.

### Challenges and decisions

**1. A recovery cost that is negative.**
The audit flagged a negative recovery cost of about -167,000 across the portfolio. It was not a bug: a recovery option costs money, but the days it recovers save time-related costs, and sometimes the savings win. Rather than hide it or "fix" it, I relabelled the figure "net recovery cost" and showed a negative as "€N saving", with a tooltip that explains the arithmetic. *Lesson: a number that looks wrong is sometimes right, and the fix is clearer wording.*

**2. Making wrong numbers impossible to ship.**
Manually checking 126 pages does not scale, so I wrote an audit that opens each page in a real browser and fails it for the things a person would call "broken". Its first runs found percentages in the hundreds of thousands (for example 137,629%) on two reconciliation pages, ten pages printing raw codes such as `AT_RISK`, and a board page that scrolled sideways on a phone. I fixed each at the source: capped percentages as ">999%", a shared label helper, and a one-line CSS change. *Lesson: build the checker once and every later feature gets the same scrutiny for free.*

**3. A phone-width bug caused by invisible text.**
On the action board, the page was 218 px too wide on a phone. The audit's culprit search narrowed it to a screen-reader-only label inside a column that was scrolled out of view. The board scrolled sideways, but it was not a positioned box, so the hidden label escaped the board's scroll area and stretched the whole page. Adding `position: relative` to the board contained it. *Lesson: accessibility helpers behave like any other element in the layout.*

**4. False alarms are as costly as missed bugs.**
Early audit versions flagged helpful notices as errors and legitimate negative change figures as faults. I refined the rules until a warning meant "look at this", which is what makes people trust a checker.

### Results

- 126 routes, more than 80 of them focused feature pages.
- The audit opens every route with no failures.
- Every page also checked at 390 px phone width.
- Ten label problems, two percentage problems and one phone-layout problem found and fixed through the audit.

### What I would do next

Add authentication and roles, cover the create, update and approve flows with automated tests, tune the risk thresholds with real site teams, and add email or chat alerts for the inbox.

### What I learned

- Plain-language product design (one page, one question) is a strong constraint, and it made the data model easier to reason about.
- A read-only audit gives a large codebase a safety net long before a full test suite exists.
- Honest limits ("no login yet", "thresholds are starting values") build more trust than claiming everything is finished.

## 4. Demo video outline (about 90 seconds)

Record on the **Grand Hotel Retrofit** project at 1440 px wide, in light mode.

| Time | Show | Say |
| --- | --- | --- |
| 0:00 | Portfolio dashboard | "BuildSight shows a construction company which projects are slipping." |
| 0:12 | Control tower, open one slipping project | "Every project through every lens. I'll open one that's behind." |
| 0:22 | Project forecast | "The forecast says how sure the finish date is, and how it has been moving." |
| 0:35 | Recovery options | "Each option shows cost, days recovered and the net recovery cost. Negative means it pays for itself." |
| 0:50 | A "do the numbers add up" page, for example payment certificates | "It also checks whether the data can be trusted." |
| 1:00 | Action board, drag a card | "Actions are tracked on a board that works on a phone." |
| 1:10 | Phone view of the same board | "Site managers read this standing on site." |
| 1:20 | Terminal with the audit result | "Every route is checked by an automated browser audit." |
| 1:28 | Title card with links | "Code and live demo are linked below." |

## 5. Talking points for interviews

- **Why this domain?** Construction delays are expensive and the signs are visible weeks before the report. [Add your own reason.]
- **What was the hardest part?** The recovery model: netting option cost against time-related savings, and presenting a negative result honestly.
- **How did you test it?** A read-only Playwright audit across every route at two widths, plus the type check. Write flows are not yet covered, and I say so.
- **What would you change?** Authentication and roles first, then write-flow tests.
- **Did you use AI tools?** [Be ready to answer this one honestly. If you built with Claude Code, say so and describe what you decided, reviewed and verified yourself.]
