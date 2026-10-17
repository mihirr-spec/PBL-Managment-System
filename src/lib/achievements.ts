import type { Achievement, Student } from "@/lib/types";

/**
 * Achievement categories and their templates.
 *
 * Each template is modelled on how Manipal University Jaipur announces a
 * student's achievement on LinkedIn: the questions are exactly the facts those
 * posts state (event, position, organiser, venue, team, what was built ...),
 * so once the supervisor approves, the post can be written from the answers.
 * Placements, faculty news, rankings and fests are deliberately left out.
 *
 * To add a template, append it to an existing category (or add a category).
 * Keys are stored with each achievement, so never rename one in use.
 */

export interface AchievementField {
  key: string;
  label: string;
  placeholder?: string;
  /** Optional questions may be skipped; their part of the post is dropped. */
  optional?: boolean;
  long?: boolean;
}

export interface AchievementTemplate {
  key: string;
  label: string;
  /** One line shown when choosing a template. */
  hint: string;
  fields: AchievementField[];
  /** Suggested title, from the answers. */
  title: (a: Record<string, string>) => string;
  /**
   * The LinkedIn post. `{key}` is an answer or a student detail ({name},
   * {year}, {programme}, {branch}). A `[[ ... ]]` part is dropped when any
   * value inside it is empty.
   */
  post: string;
}

export interface AchievementCategory {
  key: string;
  label: string;
  blurb: string;
  templates: AchievementTemplate[];
}

const TAGS = "#MUJ #ManipalUniversityJaipur #ProudMoment #StudentAchievement";

export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
  {
    key: "hackathons",
    label: "Hackathons & Tech Competitions",
    blurb: "Smart India Hackathon, company hackathons, coding contests, ideathons.",
    templates: [
      {
        key: "hackathon_win",
        label: "Won or placed at a hackathon",
        hint: "e.g. 1st Prize at Smart India Hackathon, 2nd Runner-Up at a company hackathon.",
        fields: [
          { key: "event", label: "Hackathon name and edition", placeholder: "Smart India Hackathon 2026 - Software Edition" },
          { key: "position", label: "Position or prize", placeholder: "1st Prize / Winner / 2nd Runner-Up" },
          { key: "organiser", label: "Organised by", placeholder: "Ministry of Education's Innovation Cell & AICTE" },
          { key: "venue", label: "Where it was held", placeholder: "IIT Jammu (or Online)", optional: true },
          { key: "team", label: "Team name and size", placeholder: "Team Kisan (6 members)", optional: true },
          { key: "problem", label: "Problem statement / what you built", placeholder: "Offline crop-disease detection app for farmers", long: true },
          { key: "role", label: "Your role in the team", placeholder: "Team lead - model training", optional: true },
          { key: "prize", label: "Prize money or reward", placeholder: "₹1,00,000 cash prize", optional: true },
        ],
        title: (a) => `${a.position || "Winner"} - ${a.event || "Hackathon"}`,
        post:
          "🏆 Proud moment for MUJ!\n\n" +
          "{name}, a {year} {programme} student ({branch}), has secured {position} at {event}[[, organised by {organiser}]][[, held at {venue}]].\n\n" +
          "[[Competing as {team}, ]]the team built {problem}.[[ {name} contributed as {role}.]][[ The win comes with {prize}.]]\n\n" +
          "Heartiest congratulations on this outstanding achievement! 👏\n\n" +
          `#Hackathon #Innovation ${TAGS}`,
      },
      {
        key: "coding_contest",
        label: "Ranked in a coding contest",
        hint: "e.g. ICPC regionals, CodeChef / Codeforces / LeetCode contest ranks.",
        fields: [
          { key: "contest", label: "Contest", placeholder: "ICPC Asia Amritapuri Regional 2026" },
          { key: "rank", label: "Rank or result", placeholder: "All India Rank 37" },
          { key: "participants", label: "Out of how many participants/teams", placeholder: "4,200 teams", optional: true },
          { key: "organiser", label: "Organised by", placeholder: "ICPC Foundation", optional: true },
        ],
        title: (a) => `${a.rank || "Ranked"} - ${a.contest || "Coding contest"}`,
        post:
          "💻 Congratulations, {name}!\n\n" +
          "Our {year} {programme} student ({branch}) achieved {rank} at {contest}[[ among {participants}]][[, organised by {organiser}]].\n\n" +
          "A brilliant display of problem-solving and consistency. Keep coding! 🚀\n\n" +
          `#CompetitiveProgramming ${TAGS}`,
      },
    ],
  },
  {
    key: "research",
    label: "Research & Publications",
    blurb: "Papers presented at conferences, journal publications, book chapters.",
    templates: [
      {
        key: "paper_presented",
        label: "Paper presented at a conference",
        hint: "e.g. a paper accepted and presented at an IEEE / Springer conference.",
        fields: [
          { key: "paper", label: "Paper title", placeholder: "Lightweight CNNs for On-Device Leaf Disease Classification" },
          { key: "conference", label: "Conference", placeholder: "International Conference on Intelligent Computing and Vision (ICICV 2026)" },
          { key: "publisher", label: "Proceedings publisher", placeholder: "IEEE / Springer / Elsevier", optional: true },
          { key: "venue", label: "Where it was held", placeholder: "BINUS University, Indonesia (or Online)", optional: true },
          { key: "coauthors", label: "Co-authors", placeholder: "Names, including faculty guides", optional: true },
          { key: "link", label: "DOI or proceedings link", placeholder: "https://doi.org/…", optional: true },
        ],
        title: (a) => `Paper presented at ${a.conference || "a conference"}`,
        post:
          "📄 Research spotlight!\n\n" +
          "{name}, a {year} {programme} student ({branch}), presented the paper \"{paper}\" at {conference}[[, held at {venue}]].[[ The paper will appear in the {publisher} proceedings.]]\n\n" +
          "[[Co-authored with {coauthors}.]]\n\n" +
          "Congratulations on this contribution to research! 🎓\n\n" +
          `#Research #Conference ${TAGS}`,
      },
      {
        key: "journal_publication",
        label: "Published in a journal",
        hint: "A paper published in a peer-reviewed journal.",
        fields: [
          { key: "paper", label: "Paper title" },
          { key: "journal", label: "Journal", placeholder: "Scientific Reports (Nature Portfolio)" },
          { key: "indexing", label: "Indexing / quartile", placeholder: "SCIE, Q1", optional: true },
          { key: "coauthors", label: "Co-authors", optional: true },
          { key: "link", label: "DOI or link", placeholder: "https://doi.org/…", optional: true },
        ],
        title: (a) => `Published in ${a.journal || "a journal"}`,
        post:
          "📚 Published!\n\n" +
          "Congratulations to {name}, {year} {programme} student ({branch}), whose paper \"{paper}\" has been published in {journal}[[ ({indexing})]].\n\n" +
          "[[Co-authored with {coauthors}.]][[ Read it here: {link}]]\n\n" +
          `#Research #Publication ${TAGS}`,
      },
    ],
  },
  {
    key: "patents",
    label: "Patents, Startups & Innovation",
    blurb: "Patents published or granted, startups, incubation, funding.",
    templates: [
      {
        key: "patent",
        label: "Patent published or granted",
        hint: "e.g. a patent application published by the Indian Patent Office.",
        fields: [
          { key: "invention", label: "Title of the invention" },
          { key: "stage", label: "Status", placeholder: "Published / Granted" },
          { key: "office", label: "Patent office", placeholder: "Indian Patent Office" },
          { key: "number", label: "Application / patent number", optional: true },
          { key: "inventors", label: "Co-inventors", optional: true },
          { key: "summary", label: "What it does, in a line", long: true },
        ],
        title: (a) => `Patent ${(a.stage || "published").toLowerCase()} - ${a.invention || "invention"}`,
        post:
          "💡 Innovation at MUJ!\n\n" +
          "{name}, a {year} {programme} student ({branch}), has had a patent {stage} by the {office} for \"{invention}\"[[ (Application No. {number})]].\n\n" +
          "{summary}[[ Co-inventors: {inventors}.]]\n\n" +
          "Congratulations on turning an idea into intellectual property! 👏\n\n" +
          `#Patent #Innovation ${TAGS}`,
      },
      {
        key: "startup",
        label: "Startup, incubation or funding",
        hint: "e.g. selected for an incubator, won a grant, raised funding.",
        fields: [
          { key: "startup", label: "Startup name" },
          { key: "milestone", label: "Milestone", placeholder: "Selected for incubation / raised a ₹10 lakh grant" },
          { key: "by", label: "From / by", placeholder: "MUJ Incubation Centre / Startup India Seed Fund" },
          { key: "what", label: "What the startup does", long: true },
        ],
        title: (a) => `${a.startup || "Startup"} - ${a.milestone || "milestone"}`,
        post:
          "🚀 Student entrepreneurship!\n\n" +
          "{startup}, founded by {name} ({year} {programme}, {branch}), has achieved a major milestone: {milestone}[[ from {by}]].\n\n" +
          "{what}\n\n" +
          "Wishing the team every success ahead!\n\n" +
          `#Startup #Entrepreneurship ${TAGS}`,
      },
    ],
  },
  {
    key: "sports",
    label: "Sports",
    blurb: "Medals and selections - university, state, national and international.",
    templates: [
      {
        key: "sports_medal",
        label: "Won a medal or title",
        hint: "e.g. Silver at an ISSF World Cup, Gold at an inter-university championship.",
        fields: [
          { key: "sport", label: "Sport and event", placeholder: "10 m Air Pistol (Women's)" },
          { key: "medal", label: "Medal or position", placeholder: "Gold / Silver / Bronze / Champion" },
          { key: "event", label: "Championship", placeholder: "ISSF World Cup 2026" },
          { key: "level", label: "Level", placeholder: "International / National / State / Zonal" },
          { key: "venue", label: "Where it was held", optional: true },
          { key: "organiser", label: "Organised by", optional: true },
        ],
        title: (a) => `${a.medal || "Medal"} - ${a.event || "Championship"}`,
        post:
          "🥇 Champion at MUJ!\n\n" +
          "{name}, a {year} {programme} student, has won {medal} in {sport} at the {event}[[, held in {venue}]].\n\n" +
          "A remarkable {level}-level achievement that makes the entire MUJ family proud.[[ The championship was organised by {organiser}.]]\n\n" +
          "Congratulations and best wishes for the competitions ahead! 👏\n\n" +
          `#Sports #Champion ${TAGS}`,
      },
      {
        key: "sports_selection",
        label: "Selected to represent state / India / university",
        hint: "e.g. selected for the national team or the All India Inter-University squad.",
        fields: [
          { key: "team", label: "Selected for", placeholder: "Indian team / Rajasthan state team / AIU squad" },
          { key: "sport", label: "Sport" },
          { key: "event", label: "For which event", placeholder: "Asian Games 2026", optional: true },
          { key: "recognition", label: "Award or felicitation received", placeholder: "Honoured by the Chief Minister of Rajasthan", optional: true },
        ],
        title: (a) => `Selected for ${a.team || "the team"} - ${a.sport || "sport"}`,
        post:
          "🎽 Representing with pride!\n\n" +
          "{name}, a {year} {programme} student, has been selected for the {team} in {sport}[[ for {event}]].\n\n" +
          "[[{name} was also {recognition}. ]]We wish {name} the very best!\n\n" +
          `#Sports ${TAGS}`,
      },
    ],
  },
  {
    key: "awards",
    label: "Awards, Honours & Scholarships",
    blurb: "Student Excellence Awards, national recognition and records, scholarships and fellowships.",
    templates: [
      {
        key: "excellence_award",
        label: "Award or honour received",
        hint: "e.g. a department Student Excellence Award, a best-student award.",
        fields: [
          { key: "award", label: "Award", placeholder: "Student Excellence Award 2026 - Innovation" },
          { key: "by", label: "Presented by", placeholder: "Department of Data Science and Engineering, SoCSE" },
          { key: "for", label: "Awarded for", placeholder: "Outstanding contribution to innovation and research", long: true },
        ],
        title: (a) => a.award || "Award received",
        post:
          "🌟 Celebrating excellence!\n\n" +
          "{name}, a {year} {programme} student ({branch}), has received the {award}[[ from {by}]], for {for}.\n\n" +
          "Heartiest congratulations on this well-deserved recognition! 👏\n\n" +
          `#Excellence #Award ${TAGS}`,
      },
      {
        key: "national_recognition",
        label: "Record or national recognition",
        hint: "e.g. a Limca / India Book of Records entry, recognition from a government body.",
        fields: [
          { key: "recognition", label: "Recognition", placeholder: "Entry in the India Book of Records" },
          { key: "by", label: "Recognised by", placeholder: "India Book of Records / Government of India" },
          { key: "for", label: "For what", long: true },
        ],
        title: (a) => a.recognition || "National recognition",
        post:
          "🇮🇳 National recognition for an MUJ student!\n\n" +
          "{name}, a {year} {programme} student ({branch}), has earned {recognition}[[ from {by}]] for {for}.\n\n" +
          "A proud moment for the university. Congratulations! 🎉\n\n" +
          `#Recognition ${TAGS}`,
      },
      {
        key: "scholarship",
        label: "Scholarship, fellowship or research internship",
        hint: "e.g. a merit scholarship, MITACS / DAAD / IIT research fellowship.",
        fields: [
          { key: "scholarship", label: "Scholarship or fellowship", placeholder: "MITACS Globalink Research Internship 2026" },
          { key: "host", label: "Host institution / awarding body", placeholder: "University of Toronto, Canada" },
          { key: "value", label: "Value or duration", placeholder: "12 weeks, fully funded", optional: true },
          { key: "topic", label: "Research topic", optional: true },
        ],
        title: (a) => a.scholarship || "Scholarship",
        post:
          "🎓 Going global!\n\n" +
          "{name}, a {year} {programme} student ({branch}), has been awarded the {scholarship}[[ at {host}]][[ ({value})]].[[ The work will focus on {topic}.]]\n\n" +
          "Congratulations and all the best for this journey! ✈️\n\n" +
          `#Scholarship #Research ${TAGS}`,
      },
    ],
  },
  {
    key: "clubs",
    label: "Clubs & Student Leadership",
    blurb: "Awards won by a club or chapter you lead, or a leadership role at national level.",
    templates: [
      {
        key: "club_award",
        label: "Club or chapter award",
        hint: "e.g. IEEE SB named #1 club by DSW, best student chapter award.",
        fields: [
          { key: "club", label: "Club or chapter", placeholder: "IEEE Student Branch, CSE" },
          { key: "award", label: "Award", placeholder: "#1 Club at MUJ" },
          { key: "by", label: "Awarded by", placeholder: "Directorate of Student Welfare (DSW)" },
          { key: "role", label: "Your role in the club", placeholder: "Chairperson" },
          { key: "highlights", label: "What the club did to earn it", long: true, optional: true },
        ],
        title: (a) => `${a.club || "Club"} - ${a.award || "award"}`,
        post:
          "🏅 Leadership that delivers!\n\n" +
          "The {club}, led by {role} {name} ({year} {programme}), has been awarded {award}[[ by the {by}]].\n\n" +
          "[[{highlights}\n\n]]" +
          "Congratulations to {name} and the whole team! 👏\n\n" +
          `#StudentLeadership #Clubs ${TAGS}`,
      },
    ],
  },
  {
    key: "competitions",
    label: "Design, Debate & Other Competitions",
    blurb: "Architecture and design awards, debates, MUNs, quizzes, case competitions - not fests.",
    templates: [
      {
        key: "competition_win",
        label: "Won a competition",
        hint: "e.g. a CoA / NIASA thesis award, best delegate at an MUN, a case competition.",
        fields: [
          { key: "competition", label: "Competition", placeholder: "CoA National Awards 2026 - Thesis" },
          { key: "position", label: "Position or award", placeholder: "Winner / Best Delegate / Special Mention" },
          { key: "organiser", label: "Organised by", optional: true },
          { key: "entry", label: "Your entry / topic", long: true, optional: true },
        ],
        title: (a) => `${a.position || "Winner"} - ${a.competition || "Competition"}`,
        post:
          "✨ Congratulations, {name}!\n\n" +
          "Our {year} {programme} student ({branch}) has won {position} at {competition}[[, organised by {organiser}]].\n\n" +
          "[[The entry: {entry}\n\n]]" +
          "A proud moment for MUJ! 🎉\n\n" +
          `#Competition ${TAGS}`,
      },
    ],
  },
];

export function findTemplate(category: string, template: string) {
  const c = ACHIEVEMENT_CATEGORIES.find((x) => x.key === category);
  return { category: c, template: c?.templates.find((t) => t.key === template) };
}

/** Most bonus marks a supervisor may award for one approved achievement. */
export const MAX_BONUS_MARKS = 5;

const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

/** Fills a template's post with the achievement's answers and the student's details. */
export function linkedInPost(
  achievement: Pick<Achievement, "category" | "template" | "answers" | "title" | "description">,
  student: Pick<Student, "fullName" | "programme" | "branch" | "semester">,
): string {
  const { template } = findTemplate(achievement.category, achievement.template);
  const values: Record<string, string> = {
    ...achievement.answers,
    name: student.fullName,
    programme: student.programme,
    branch: student.branch,
    year: student.semester ? `${ordinal(Math.ceil(student.semester / 2))}-year` : "",
  };
  const value = (k: string) => (values[k] ?? "").trim();

  if (!template) {
    return `🎉 Congratulations to ${student.fullName} on: ${achievement.title}!\n\n${achievement.description}\n\n${TAGS}`;
  }
  return template.post
    .replace(/\[\[([\s\S]*?)\]\]/g, (_, part: string) =>
      [...part.matchAll(/\{(\w+)\}/g)].every(([, k]) => value(k)) ? part : "",
    )
    .replace(/\{(\w+)\}/g, (_, k: string) => value(k))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
