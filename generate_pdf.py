import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
)
from reportlab.pdfgen import canvas


class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically compute and display 'Page X of Y' and running headers."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#718096"))

        # Running header (top left)
        self.drawString(48, 756, "Hackathon Final Report")

        # Running footer (bottom left & bottom right)
        self.drawString(48, 28, "Hackathon Final Report")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(letter[0] - 48, 28, page_str)

        self.restoreState()


def build_pdf(filename="CrisisGrid_Hackathon_Final_Report.pdf"):
    # Letter size: 612 x 792 pt. 48pt margins
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=48,
        rightMargin=48,
        topMargin=42,
        bottomMargin=42,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=21,
        textColor=colors.HexColor("#1A202C"),
        spaceAfter=3,
    )

    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=7.8,
        leading=10.5,
        textColor=colors.HexColor("#2D3748"),
        spaceAfter=8,
    )

    h1_style = ParagraphStyle(
        "SectionH1",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=13.5,
        textColor=colors.HexColor("#1A202C"),
        spaceBefore=5,
        spaceAfter=2,
        keepWithNext=True,
    )

    h2_style = ParagraphStyle(
        "SectionH2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.8,
        leading=11.2,
        textColor=colors.HexColor("#2D3748"),
        spaceBefore=4,
        spaceAfter=1.5,
        keepWithNext=True,
    )

    body_style = ParagraphStyle(
        "BodyDark",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.8,
        textColor=colors.HexColor("#2D3748"),
        spaceAfter=2.5,
    )

    table_label_style = ParagraphStyle(
        "TableLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#1A202C"),
    )

    table_val_style = ParagraphStyle(
        "TableValue",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#2D3748"),
    )

    table_link_style = ParagraphStyle(
        "TableLink",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#2B6CB0"),
    )

    story = []

    # ── Page 1 ─────────────────────────────────────────────────────────
    story.append(Paragraph("Hackathon Final Report", title_style))
    story.append(
        Paragraph(
            "This is the final submission report, due at the end of the 24-hour hackathon. "
            "Replace the bracketed text with your own. Shape each section the way that suits your idea, "
            "with your own sub-points, tables or diagrams. Aim for about one page per section.",
            subtitle_style,
        )
    )

    story.append(Paragraph("Project Details", h1_style))

    details_data = [
        [
            Paragraph("Hackathon", table_label_style),
            Paragraph("BuildBeyond 2026", table_val_style),
        ],
        [
            Paragraph("Project Title", table_label_style),
            Paragraph(
                "<b>CrisisGrid: Autonomous Multi-Agent Crisis Resource Allocation System</b>",
                table_val_style,
            ),
        ],
        [
            Paragraph("Problem Statement", table_label_style),
            Paragraph(
                "PS 1.1: Multi-Agent Resource Allocation & Grid Resilience Under Extreme Crisis",
                table_val_style,
            ),
        ],
        [
            Paragraph("Team Name", table_label_style),
            Paragraph("GridDefenders", table_val_style),
        ],
        [
            Paragraph("Team Members", table_label_style),
            Paragraph("Varun (Lead Developer & Systems Architect)", table_val_style),
        ],
        [
            Paragraph("Institution", table_label_style),
            Paragraph("BMS College of Engineering", table_val_style),
        ],
        [
            Paragraph("GitHub Repository", table_label_style),
            Paragraph(
                '<a href="https://github.com/varun-1BM24CS318/buildbeyond"><u>https://github.com/varun-1BM24CS318/buildbeyond</u></a>',
                table_link_style,
            ),
        ],
        [
            Paragraph("Demo Video / Live Prototype", table_label_style),
            Paragraph(
                '<a href="https://github.com/varun-1BM24CS318/buildbeyond"><u>Live Vercel Deployment & Interactive Command Center</u></a>',
                table_link_style,
            ),
        ],
        [
            Paragraph("Submitted On", table_label_style),
            Paragraph("15 November 2026, 03:30 AM IST", table_val_style),
        ],
    ]

    col_widths = [130, 386]
    t = Table(details_data, colWidths=col_widths)
    t.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E0")),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F7FAFC")),
                ("TOPPADDING", (0, 0), (-1, -1), 2.2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(t)
    story.append(Spacer(1, 4))

    # Section 1
    story.append(Paragraph("1. Analysis of the Problem Statement", h1_style))
    story.append(Paragraph("1.1 Problem Overview", h2_style))
    story.append(
        Paragraph(
            "During extreme natural catastrophes (cyclones, earthquakes, substation floods), physical power grids experience abrupt capacity drops of 40% to 70%. In this scarcity environment, five essential municipal infrastructure agents compete for power: Hospital ICU (Tier 1), Municipal Water Treatment (Tier 1), First Responders (Tier 1), 911 Telecom Relays (Tier 2), and Residential Feeders/Shelters (Tier 3). Traditional utility dispatching fails catastrophically: <b>Naive Proportional Load-Shedding</b> throttles all feeders uniformly, starving intensive care ventilators at the exact same rate as residential luxury loads; <b>Strict Priority Rationing</b> cuts power to municipal water and telecom, triggering hidden cross-sector cascades; and <b>Strategic Overbidding</b> allows self-interested operators to artificially inflate demand to hoard scarce power, causing life-support deficits.",
            body_style,
        )
    )

    story.append(Paragraph("1.2 Causes and Impact", h2_style))
    story.append(
        Paragraph(
            "<b>Root Causes:</b> Physical storm damage trips secondary transformers and severs transmission corridors, creating severe local bottleneck constraints and asymmetric information between decentralized infrastructure operators and central dispatchers.<br/>"
            "<b>Empirical Impact:</b> In our benchmark cyclone evaluations, conventional proportional shedding produces <b>14.8 MWh</b> in critical life-support shortfall and <b>$182,400</b> in societal/economic damage over 8 hours. Cutting power to water treatment stops cooling water to hospital chillers, halting surgical theaters even when the hospital's direct power line is intact. Similarly, dropping telecom towers blinds 911 dispatch and first-responder GPS navigation.",
            body_style,
        )
    )

    story.append(Spacer(1, 3))

    # Section 2
    story.append(Paragraph("2. Research Gap", h1_style))
    story.append(Paragraph("2.1 Existing Solutions", h2_style))
    story.append(
        Paragraph(
            "Current approaches rely on three paradigms: (1) <i>Manual SCADA Operator Dispatch</i>, which relies on phone trees and static priority tables that require 15–45 minutes to execute; (2) <i>Centralized Optimal Power Flow (OPF)</i>, which uses non-linear AC/DC models that require complete, noise-free telemetric observability across all grid buses—conditions that fail when communications go down; and (3) <i>Market Auctions & Double Auctions</i>, which price electricity dynamically, enabling wealthy commercial actors to outbid emergency public health entities while remaining vulnerable to strategic gaming.",
            body_style,
        )
    )

    # Clean PageBreak to Page 2
    story.append(PageBreak())

    # ── Page 2 ─────────────────────────────────────────────────────────
    story.append(Paragraph("2.2 Identified Gap", h2_style))
    story.append(
        Paragraph(
            "• <b>Absence of Cross-Sector Cascade Coupling:</b> Existing dispatchers treat infrastructure nodes as independent consumers (<i>U<sub>i</sub>(x<sub>i</sub>)</i>), completely ignoring cross-infrastructure physical dependency matrices (<i>&kappa;<sub>ij</sub></i>).<br/>"
            "• <b>Vulnerability to Strategic Misreporting:</b> Current mechanisms lack game-theoretic strategy-proofness; dishonest agents can inflate bids by 2x–3x without penalty to hoard power.<br/>"
            "• <b>Lack of Deterministic Safety Guarantees:</b> Black-box ML dispatchers cannot mathematically prove that allocations will never exceed feeder capacity (<i>&Sigma; x<sub>i</sub> &le; C</i>), risking transformer fires.<br/>"
            "• <b>Absence of Cryptographic Auditability:</b> Post-crisis inquiries cannot verify why specific feeders were shed, destroying civic transparency.",
            body_style,
        )
    )

    story.append(Spacer(1, 3))

    # Section 3
    story.append(Paragraph("3. Ideation of the Solution", h1_style))
    story.append(Paragraph("3.1 Proposed Solution", h2_style))
    story.append(
        Paragraph(
            "<b>CrisisGrid</b> is an autonomous multi-agent crisis resource allocation platform governed by: (1) <b>Strict Safety Invariants</b> enforcing <i>&Sigma; x<sub>i</sub> &le; C</i> (0 violations across 10,000 Hypothesis property tests); (2) <b>3-Stage Lexicographic Linear Program (SciPy HiGHS)</b> executing Stage A (Survival Minimums) &rarr; Stage B (Cascade Welfare Maximization) &rarr; Stage C (Max-Min Fairness with Jain's Index &gt; 0.89); (3) <b>VCG Clarke Pivot Mechanism</b> charging peer externality taxes that guarantee truthful reporting yields optimal utility (best gain from lying = 0.0000 MW across 125 sweeps); (4) <b>Append-Only SHA-256 Ledger</b> chaining every bid, concession, and allocation into an immutable audit block; and (5) <b>Next.js 16 Real-Time Command Center</b> offering live 24-hour analytics, interactive negotiation floor, and disaster injection.",
            body_style,
        )
    )

    story.append(Paragraph("3.2 How It Works", h2_style))
    story.append(
        Paragraph(
            "<b>Workflow & Architecture:</b> Agents submit cryptographically signed bids bounded by telemetry certs (<i>0 &le; M<sub>i</sub> &le; x<sub>i</sub> &le; D<sub>i</sub><sup>cert</sup></i>). The stateless mediator executes a 4-round protocol: <i>Round 0</i> verifies bid bounds; <i>Round 1</i> checks capacity vs. aggregate demand; <i>Round 2</i> negotiates progressive concessions (Tier 3 discretionary shedding, Tier 2 bandwidth scaling); and <i>Round 3</i> executes the HiGHS 3-stage solver in <b>1.9 ms</b>. Allocations are validated against feeder thermal limits, sealed into SHA-256 ledger blocks, and streamed over WebSockets to the reactive dashboard.",
            body_style,
        )
    )

    story.append(Spacer(1, 3))

    # Section 4
    story.append(Paragraph("4. Implementation Roadmap", h1_style))
    story.append(Paragraph("4.1 Work Completed in 24 Hours", h2_style))
    story.append(
        Paragraph(
            "• Built complete working full-stack prototype: Python 3.13 FastAPI backend + Next.js 16 / React 19 frontend.<br/>"
            "• Implemented 3-Stage Lexicographic LP (SciPy HiGHS) solving in 1.9 ms; <b>74/74 passing pytest tests</b>.<br/>"
            "• Formulated interdependent physical cascade model (<i>Water &rarr; Hospital</i>, <i>Telecom &rarr; Emergency</i>).<br/>"
            "• Verified strategy-proof VCG Clarke Pivot taxes across 125 empirical sweep misreports (max cheating gain: 0.0000 MW).<br/>"
            "• Built discrete 24-step trajectory stacked chart, 4-round animated negotiation floor, and post-simulation 24-hour results panel.<br/>"
            "• Deployed live to Vercel and pushed to GitHub.",
            body_style,
        )
    )

    story.append(Paragraph("4.2 Future Roadmap", h2_style))
    story.append(
        Paragraph(
            "• <b>Phase 1 (Months 1–3):</b> Hardware-in-the-Loop (HIL) testing with OPAL-RT real-time power grid simulator on IEEE 33-bus feeders; integration with Modbus TCP and IEC 61850 industrial protocols.<br/>"
            "• <b>Phase 2 (Months 3–6):</b> Edge microcontroller deployment (Raspberry Pi CM4 / ESP32) with peer-to-peer gossip consensus over LoRaWAN/satellite for zero-connectivity situations.<br/>"
            "• <b>Phase 3 (Months 6–12):</b> Pilot deployment with municipal emergency disaster management agencies (NDMA/FEMA) and microgrid utility operators.",
            body_style,
        )
    )

    story.append(Spacer(1, 3))

    # Section 5
    story.append(Paragraph("5. SDG Mapping", h1_style))
    story.append(
        Paragraph(
            "• <b>SDG 7 (Affordable and Clean Energy - 7.1, 7.2):</b> Prevents total blackouts, optimizes scarce energy dispatch during crises, and coordinates microgrid battery storage.<br/>"
            "• <b>SDG 9 (Industry, Innovation & Infrastructure - 9.1, 9.4):</b> Enhances electrical grid structural resilience, preventing physical transformer burnouts through strict capacity enforcement.<br/>"
            "• <b>SDG 11 (Sustainable Cities & Communities - 11.5, 11.b):</b> Protects urban lifelines (water treatment, shelters, emergency comms) during extreme weather disasters.<br/>"
            "• <b>SDG 3 (Good Health and Well-Being - 3.8, 3.d):</b> Guarantees 0.0 MWh critical survival shortfall to hospitals, keeping ventilators and ICUs powered.<br/>"
            "• <b>SDG 13 (Climate Action - 13.1):</b> Builds adaptive urban disaster resilience against climate-induced extreme storms and cyclones.",
            body_style,
        )
    )

    story.append(Spacer(1, 3))

    # References
    story.append(Paragraph("References", h1_style))
    story.append(
        Paragraph(
            "[1] Clarke, E. H. (1971). Multipart pricing of public goods. <i>Public Choice</i>, 11(1), 17–33.<br/>"
            "[2] Groves, T. (1973). Incentives in teams. <i>Econometrica</i>, 617–631.<br/>"
            "[3] Huang, Q., et al. (2021). HiGHS: High performance software for linear optimization. <i>Math. Prog. Comp.</i>, 13(2), 221–254.<br/>"
            "[4] Jain, R., et al. (1984). A quantitative measure of fairness and discrimination for resource allocation. <i>DEC-TR-301</i>.<br/>"
            "[5] Rinaldi, S. M., et al. (2001). Identifying, understanding, and analyzing critical infrastructure interdependencies. <i>IEEE CSM</i>, 21(6), 11–25.<br/>"
            "[6] United Nations (2015). Transforming our world: The 2030 Agenda for Sustainable Development (SDGs 3, 7, 9, 11, 13).",
            body_style,
        )
    )

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated {filename}")


if __name__ == "__main__":
    build_pdf()
