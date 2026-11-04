// The organizations the research names, for the board's "Load the research list" (2026-11-03):
// steadfast-ai docs/ideas/2026-09-church-nonprofit-research.md and
// docs/ideas/2026-09-boring-profitable-research.md (researched 2026-09-08), and this repo's
// docs/research/marketing-channels.md (researched 2026-10-27). Facts only from those documents,
// nothing checked since, and no contact details, because the research recorded none. A business
// already on the board is skipped when this loads, so loading it twice adds nothing.
//
// A plain module rather than JSON so it imports the same way in the Pages Functions bundle and in
// the tests under Node.

export const seedLeads = [
  {
    "kind": "partner",
    "business": "Lancaster Mennonite Conference (LMC)",
    "category": "church network",
    "town": "Lancaster County",
    "website": "https://www.lancastermennonite.org",
    "source": "steadfast-ai docs/ideas/2026-09-church-nonprofit-research.md §0, A1, A3",
    "why": "218 congregations. The church website + grounded assistant bundle (A3) names LMC congregations without sites as its third customer group: walk the LMC directory. The pastoral-relations office is also the channel named for the PA clearance tracker (A1).",
    "nextStep": "Walk the LMC congregation directory for churches with no website or no service times"
  },
  {
    "kind": "partner",
    "business": "Love INC of Lancaster County",
    "category": "nonprofit network",
    "town": "Lancaster County",
    "source": "steadfast-ai docs/ideas/2026-09-church-nonprofit-research.md §0, B1 (listed at https://blogs.millersville.edu/nrn/nonprofits-directory/love-inc/)",
    "why": "Benevolence clearinghouse of 100+ churches from 24 denominations. Proposed as the partner and channel for the confidential benevolence ledger (B1), and a door to many small churches at once."
  },
  {
    "kind": "partner",
    "business": "Lancaster County Council of Churches",
    "category": "nonprofit",
    "town": "Lancaster",
    "source": "steadfast-ai docs/ideas/2026-09-church-nonprofit-research.md §B1, B2 (https://www.causeiq.com/organizations/lancaster-county-council-of-churches,231429852/)",
    "why": "Runs a food hub, a clothing bank and Wheels to Work. Named as a first customer for the benevolence ledger (B1) and the food-pantry intake (B2)."
  },
  {
    "kind": "partner",
    "business": "Community Action Partnership of Lancaster County (CAP)",
    "category": "nonprofit",
    "town": "Lancaster",
    "website": "https://caplanc.org",
    "source": "steadfast-ai docs/ideas/2026-09-church-nonprofit-research.md §B2",
    "why": "Its warehouse supplies 40 participating pantry organizations: the channel named for the food-pantry intake (B2), and 40 small organizations in one list."
  },
  {
    "kind": "partner",
    "business": "Christian Business Fellowship, Lancaster chapter",
    "category": "business network",
    "town": "Lancaster",
    "website": "https://cbf-global.org/lancaster-chapter/",
    "source": "steadfast-ai docs/ideas/2026-09-church-nonprofit-research.md §A3",
    "why": "First-Thursday breakfast. The research expects to meet two pastors for the church website + assistant bundle (A3) here or at Believers in Business.",
    "nextStep": "Go to a first-Thursday breakfast"
  },
  {
    "kind": "partner",
    "business": "Believers in Business, Lancaster chapter",
    "category": "business network",
    "town": "Lancaster County",
    "website": "https://www.bibnetwork.org/chapters/lancaster/",
    "source": "steadfast-ai docs/ideas/2026-09-church-nonprofit-research.md §A3",
    "why": "Meets at the Centerville Diner on the 1st and 3rd Wednesday. The other room where the research expects to meet pastors and Christian business owners for the church bundle (A3)."
  },
  {
    "kind": "partner",
    "business": "Susquehanna Conference (United Methodist)",
    "category": "church network",
    "website": "https://susumc.org",
    "source": "steadfast-ai docs/ideas/2026-09-church-nonprofit-research.md §A1",
    "why": "Requires three clearances plus Safe Sanctuaries training every five years and leaves the records to the local church. The district office fields 'how do we track this' questions, so it is the referral channel named for the PA clearance tracker (A1)."
  },
  {
    "kind": "partner",
    "business": "Presbytery of Donegal",
    "category": "church network",
    "town": "Lancaster",
    "website": "https://www.donegalpby.org",
    "source": "steadfast-ai docs/ideas/2026-09-church-nonprofit-research.md §A1",
    "why": "Requires clearance copies on file; its staff field the same tracking questions (A1 channel)."
  },
  {
    "kind": "partner",
    "business": "Faithful Give",
    "category": "giving day",
    "website": "https://faithfulgive.org",
    "source": "steadfast-ai docs/ideas/2026-09-church-nonprofit-research.md §0, A2",
    "why": "A faith-based giving day that grew from 54 to 93 'Kingdom Causes' in a year: a values-aligned list of small nonprofits, named as a channel for the funder-report drafter (A2)."
  },
  {
    "kind": "partner",
    "business": "Lancaster County Community Foundation (ExtraGive)",
    "category": "nonprofit network",
    "town": "Lancaster",
    "website": "https://www.extragive.org",
    "source": "steadfast-ai docs/ideas/2026-09-church-nonprofit-research.md §0, A2; SteadfastCode docs/research/marketing-channels.md §2",
    "why": "ExtraGive had 444–453 participating organizations and $8.9M in a day; its nonprofit trainings put hundreds of small organizations in one room (A2 channel). Nonprofits get $8k–$10k capacity grants that can include marketing; it does not fund religious causes."
  },
  {
    "kind": "partner",
    "business": "Leadership Lancaster",
    "category": "nonprofit network",
    "town": "Lancaster",
    "website": "https://leadershiplancaster.org",
    "source": "steadfast-ai docs/ideas/2026-09-church-nonprofit-research.md §A2",
    "why": "Board Leadership Academy alumni, named as a channel for the funder-report drafter (A2)."
  },
  {
    "kind": "prospect",
    "business": "Black Rock Retreat",
    "category": "retreat center",
    "town": "Lancaster County",
    "source": "steadfast-ai docs/ideas/2026-09-church-nonprofit-research.md §B7 (https://www.mennonitecamping.org/black-rock.html; https://www.discoverlancaster.com/blog/10-retreat-venues-in-lancaster-pa/)",
    "why": "Church-affiliated retreat center in the Lancaster cluster, a Mennonite Camping Association member. The research found no evidence of what these centers use for group quotes and booking today and calls for two discovery calls before any build (B7)."
  },
  {
    "kind": "prospect",
    "business": "Refreshing Mountain",
    "category": "retreat center",
    "town": "Lancaster County",
    "source": "steadfast-ai docs/ideas/2026-09-church-nonprofit-research.md §B7 (https://www.discoverlancaster.com/blog/10-retreat-venues-in-lancaster-pa/)",
    "why": "Church-affiliated retreat center in the Lancaster cluster. The research found no evidence of what these centers use for group quotes and booking today and calls for two discovery calls before any build (B7)."
  },
  {
    "kind": "prospect",
    "business": "Camp Andrews",
    "category": "retreat center",
    "town": "Lancaster County",
    "source": "steadfast-ai docs/ideas/2026-09-church-nonprofit-research.md §B7 (https://www.discoverlancaster.com/blog/10-retreat-venues-in-lancaster-pa/)",
    "why": "Church-affiliated retreat center in the Lancaster cluster. The research found no evidence of what these centers use for group quotes and booking today and calls for two discovery calls before any build (B7)."
  },
  {
    "kind": "prospect",
    "business": "Woodcrest Retreat",
    "category": "retreat center",
    "town": "Lancaster County",
    "source": "steadfast-ai docs/ideas/2026-09-church-nonprofit-research.md §B7 (https://www.discoverlancaster.com/blog/10-retreat-venues-in-lancaster-pa/)",
    "why": "Church-affiliated retreat center in the Lancaster cluster. The research found no evidence of what these centers use for group quotes and booking today and calls for two discovery calls before any build (B7)."
  },
  {
    "kind": "prospect",
    "business": "Camp Conquest",
    "category": "retreat center",
    "town": "Lancaster County",
    "source": "steadfast-ai docs/ideas/2026-09-church-nonprofit-research.md §B7 (https://www.discoverlancaster.com/blog/10-retreat-venues-in-lancaster-pa/)",
    "why": "Church-affiliated retreat center in the Lancaster cluster. The research found no evidence of what these centers use for group quotes and booking today and calls for two discovery calls before any build (B7)."
  },
  {
    "kind": "partner",
    "business": "Building Industry Association of Lancaster County",
    "category": "trade association",
    "town": "Lancaster County",
    "website": "https://members.lancasterbuilders.org/list/category/general-contractor-81",
    "source": "steadfast-ai docs/ideas/2026-09-boring-profitable-research.md (local channel facts; B1)",
    "why": "Lists 24 general-contractor members: the first customers named for the sub-compliance tracker (B1), and the trades the AI front desk (A1) sells to. Lancaster County had 1,962 construction establishments in 2025."
  },
  {
    "kind": "partner",
    "business": "Lancaster Chamber",
    "category": "chamber of commerce",
    "town": "Lancaster",
    "website": "https://lancasterchamber.com",
    "source": "SteadfastCode docs/research/marketing-channels.md §2, §6",
    "why": "$550 a year for 1–5 employees. Monthly Mixers, Get Connected and YPN are evening-friendly, and roughly 80% of members are small businesses. The plan's first relational channel: join in days 15–45.",
    "nextStep": "Join; go to a Monthly Mixer and one Get Connected"
  },
  {
    "kind": "partner",
    "business": "Northern Lancaster County Chamber of Commerce",
    "category": "chamber of commerce",
    "town": "Ephrata",
    "website": "https://www.northernlancasterchamber.org",
    "source": "SteadfastCode docs/research/marketing-channels.md §2, §8",
    "why": "Covers Lititz; 480+ members, a Business Expo and 'Chamber Chat' events. Dues not published (unverified).",
    "nextStep": "Ask about dues; go to a Chamber Chat"
  },
  {
    "kind": "partner",
    "business": "Manheim Area Chamber of Commerce",
    "category": "chamber of commerce",
    "town": "Manheim",
    "source": "SteadfastCode docs/research/marketing-channels.md §2, §6",
    "why": "Members, and a possible first speaking slot in days 46–90. Dues not published."
  },
  {
    "kind": "partner",
    "business": "Venture Lititz",
    "category": "downtown association",
    "town": "Lititz",
    "website": "https://lititzpa.com",
    "source": "SteadfastCode docs/research/marketing-channels.md §2",
    "why": "Donation-based and volunteer-run; Fire & Ice and Second Fridays put the Lititz merchants in one place. The plan says volunteer rather than join."
  },
  {
    "kind": "partner",
    "business": "SCORE Lancaster-Lebanon",
    "category": "mentoring",
    "town": "Lancaster",
    "website": "https://www.score.org/pa/susquehanna-valley/",
    "source": "SteadfastCode docs/research/marketing-channels.md §2, §6",
    "why": "Free mentoring and ~$25 workshops. Request a mentor in days 15–45; mentors are referral partners, and SCORE is a possible speaking slot.",
    "nextStep": "Request a mentor"
  },
  {
    "kind": "partner",
    "business": "ASSETS Lancaster",
    "category": "nonprofit",
    "town": "Lancaster",
    "website": "https://assetspa.org",
    "source": "SteadfastCode docs/research/marketing-channels.md §2, §6",
    "why": "Free or low-cost programs; its new-business cohorts are 0–2 leads a month. Events in days 15–45."
  },
  {
    "kind": "partner",
    "business": "Lancaster Public Library — Duke Street Business Center",
    "category": "library",
    "town": "Lancaster",
    "website": "https://lancasterpubliclibrary.org",
    "source": "SteadfastCode docs/research/marketing-channels.md §2",
    "why": "Business start-up toolkit; a referral point for new businesses and a possible speaking slot (whether it takes outside presenters is unverified)."
  }
];
