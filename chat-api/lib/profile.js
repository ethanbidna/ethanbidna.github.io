// The single source of truth about Ethan. The website assistant and the MCP server both read from here.
// This is a sales brief, not a biography. It contains professional strengths only. Never add personal details,
// locations, family, relationships, finances, employers, clients, schools or colleagues: the assistants must not know them.
export const PROFILE = {
  name: "Ethan S. Bidna",
  displayName: "Ethan Bidna",
  headline: "AI Product Management and Enablement",
  website: "https://www.ethanbidna.com/",
  contact: {
    email: "ethansbidna@gmail.com",
    page: "https://www.ethanbidna.com/contact/",
    linkedin: "https://www.linkedin.com/in/ethanbidna/",
  },
  summary: [
    "Ethan Bidna is a senior product manager working at the intersection of AI-powered products and analytics tools. With a background spanning data science, market research, and product management, he specializes in turning ambiguous problems into practical systems that people rely on.",
    "His work has included launching new AI-enabled products, modernizing research workflows, and leading cross-functional initiatives that connect technical capabilities with commercial outcomes. He is most interested in how AI and research technology can help organizations make better decisions with their data.",
  ],
  // Approved things to say. Positive, professional, and true to the summary above.
  talkingPoints: [
    "Turns ambiguous problems into practical systems that people rely on.",
    "Connects technical capabilities to commercial outcomes, and can speak to engineers, researchers and business leaders.",
    "Has launched new AI-enabled products and modernized research workflows.",
    "Leads cross-functional initiatives.",
    "Comes from data science and market research, so he is rigorous about evidence as well as product.",
    "Decides from the actual objective: he weighs the user or business problem, the technical and operational constraints, the alternatives and their trade-offs, the economic value and differentiation, and the most practical path to execution.",
    "Compares real alternatives, makes a clear recommendation, updates it when new evidence arrives, and favors reversible experiments when testing is cheap.",
    "Prefers sophisticated systems behind simple interfaces, with visual restraint, consistency and polish, and evidence-backed experiences whose provenance and auditability stay out of the way.",
    "Asks whether a product owns a valuable workflow or only offers a capability others can copy, and treats pricing and margin as product-design constraints.",
    "Has particular strengths in AI products, data infrastructure, automation, developer tooling and user experience.",
    "Tests what he ships: the assistant on his site is checked against a published set of evals.",
    "Is most interested in how AI and research technology can help organizations make better decisions with their data.",
  ],
  // Ethan's own views on AI product questions, in his words. The assistant reasons from these to opinions. Add real ones here.
  viewpoints: [
    "His take that many people miss: the human, non-Silicon Valley side of AI products. Most offices, including very large organizations, are still stuck in spreadsheets passed around by email, and AI does not have to be cutting edge to help. Bringing it to people's simpler everyday problems is a real market.",
    "He is proudest of the calls where he chose not to use AI. Not everything needs robust intelligence, and a more deterministic system often wins.",
    "He says no to AI when it is not necessary, when it is immoral, or when it would do long-term harm to customers.",
    "On choosing the tool: LLMs suit custom, open-ended situations, and deterministic code or classic machine learning suit problems where the approach is well known and valid.",
    "On trust and hallucination: evaluate as much as you can, restrict what the AI can do and how users can interact with it, and take extra care with health or other sensitive matters.",
    "AI enablement means helping people use AI to solve the real problems they have, filling in their knowledge gaps, and getting them the resources they need.",
    "The mistake he sees most in teams is not using their imagination: they assume they know what AI can and cannot do. His approach is to let the AI tell you it cannot do something, instead of assuming.",
    "On working with people: it is all about listening. People want to be heard and understood, and listening and relating gets you most of the way there. He talks about getting a team aligned as singing from the same songbook.",
    "He loves ambiguous problems with no track record of success, and charting new territory.",
    "For AI news he follows Lenny's Newsletter and Ethan Mollick, and listens to researchers. He deliberately avoids too many Silicon Valley voices, because it becomes circular thinking.",
    "On testing AI: he starts from failure modes, not scores, and lists the specific ways a feature can go wrong before writing any test.",
    "He makes every check a plain pass or fail, uses code wherever code can decide, and uses an LLM judge only for what code cannot, checking each judge against hand-labeled answers before trusting it.",
    "After launch he reads real conversations, looks for failures nobody predicted, and turns them into new tests.",
  ],
  // Topics every assistant must decline. Used in the instructions to AI tools; the real enforcement is in lib/guard.js.
  neverShare: ["where he lives or is from", "addresses", "phone numbers", "age", "family", "relationships", "friends", "health", "politics and religion", "finances and compensation", "hobbies and private life", "employers, companies, clients, schools or colleagues"],
};
PROFILE.facts = [
  "Name: Ethan S. Bidna.",
  "A senior product manager working at the intersection of AI-powered products and analytics tools.",
  "Background spanning data science, market research, and product management.",
  ...PROFILE.talkingPoints,
  ...PROFILE.viewpoints.map((v) => `View: ${v}`),
  "Contact: ethansbidna@gmail.com, or https://www.ethanbidna.com/contact/. LinkedIn: https://www.linkedin.com/in/ethanbidna/",
];
