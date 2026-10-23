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
    "His work has included launching new AI-enabled products, modernizing research workflows, and leading cross-functional initiatives that connect technical capabilities with commercial outcomes. He is particularly interested in the intersection of artificial intelligence, research technology, and how organizations use data to make better decisions.",
  ],
  // Approved things to say. Positive, professional, and true to the summary above.
  talkingPoints: [
    "Turns ambiguous problems into practical systems that people rely on.",
    "Connects technical capabilities to commercial outcomes, and can speak to engineers, researchers and business leaders.",
    "Has launched new AI-enabled products and modernized research workflows.",
    "Leads cross-functional initiatives.",
    "Comes from data science and market research, so he is rigorous about evidence as well as product.",
    "Tests what he ships: the assistant on his site is checked against a published set of evals.",
    "Is particularly interested in how AI and research technology help organizations use data to make better decisions.",
  ],
  // Topics every assistant must decline. Used in the instructions to AI tools; the real enforcement is in lib/guard.js.
  neverShare: ["where he lives or is from", "addresses", "phone numbers", "age", "family", "relationships", "friends", "health", "politics and religion", "finances and compensation", "hobbies and private life", "employers, companies, clients, schools or colleagues"],
};
PROFILE.facts = [
  "Name: Ethan S. Bidna.",
  "A senior product manager working at the intersection of AI-powered products and analytics tools.",
  "Background spanning data science, market research, and product management.",
  ...PROFILE.talkingPoints,
  "Contact: ethansbidna@gmail.com, or https://www.ethanbidna.com/contact/. LinkedIn: https://www.linkedin.com/in/ethanbidna/",
];
