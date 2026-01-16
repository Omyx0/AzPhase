
// WHITELIST FROM USER IMAGE
export const VALID_CODES = [
    "29242201", "29242202", "29242203", "29242204", "29242205",
    "29242206", "29242207", "29242208", "29242209", "29242210",
    "29242211", "29242212", "NECXXXXX", "SIP2XXXX"
];

// SMART MAP: Name Keywords -> Code
export const SUBJECT_MAP = [
    { keywords: ["data science lab", "science lab"], code: "29242206" }, // Lab first specific
    { keywords: ["algorithms lab", "algo lab"], code: "29242207" },
    { keywords: ["data science", "data sci"], code: "29242201" },
    { keywords: ["design and analysis", "algorithms", "daa"], code: "29242202" },
    { keywords: ["theory of computation", "toc"], code: "29242203" },
    { keywords: ["communication", "networks", "cn"], code: "29242204" },
    { keywords: ["design pattern", "patterns"], code: "29242205" },
    { keywords: ["competitive programming", "cp"], code: "29242208" },
    { keywords: ["proficiency"], code: "29242209" },
    { keywords: ["macro project", "project-ii"], code: "29242210" },
    { keywords: ["project management", "economics"], code: "29242211" },
    { keywords: ["mandatory workshop", "intellectual"], code: "29242212" },
    { keywords: ["novel engaging", "nec"], code: "NECXXXXX" },
    { keywords: ["internship", "sip"], code: "SIP2XXXX" }
];

/**
 * Resolves the subject code from a name.
 * @param {string} subjectName 
 * @returns {string|null} The resolved 8-digit code or null if not found.
 */
export const getSubjectCode = (subjectName) => {
    if (!subjectName) return null;
    const cleanSubject = subjectName.trim();
    const lowerSub = cleanSubject.toLowerCase();

    // 1. Is code already in string?
    const codeMatch = cleanSubject.match(/(\d{8}|NECXXXXX|SIP2XXXX)/);
    if (codeMatch) return codeMatch[0];

    // 2. Map by Name
    const match = SUBJECT_MAP.find(m => m.keywords.some(k => lowerSub.includes(k)));
    return match ? match.code : null;
};

/**
 * Checks if a subject is allowed based on the whitelist.
 * @param {string} subjectName 
 * @returns {boolean} True if subject is in the whitelist.
 */
export const isValidSubject = (subjectName) => {
    const code = getSubjectCode(subjectName);
    return code && VALID_CODES.includes(code);
};

/**
 * Resolves a display name (Code - Name) or just Name if code is already there.
 * @param {string} subjectName 
 * @returns {string} Formatted name
 */
export const getDisplayName = (subjectName) => {
    const code = getSubjectCode(subjectName);
    if (!code) return subjectName; // Fallback

    // If name already has code, return as is (maybe normalized)
    if (subjectName.includes(code)) return subjectName;

    // Otherwise prepend code
    return `${code} - ${subjectName}`;
}
