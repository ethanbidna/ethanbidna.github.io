import { PROFILE } from "./profile.js";

// The brief the website assistant answers from. Edit lib/profile.js, not this file.
export const FACTS = PROFILE.facts.map((f) => "- " + f).join("\n");
