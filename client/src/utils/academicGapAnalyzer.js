/**
 * Academic Gap Analyzer
 * Analyzes missed lectures, low scores, pending assignments, weak subjects
 */

export const analyzeAcademicGaps = async (studentData, assignments, classes, quizScores) => {
  const gaps = [];

  // 1. Analyze missed lectures
  // 1. Analyze missed lectures - DISABLED
  // (Cannot determine missed lectures from a static weekly schedule without historical data)
  /*
  const missedLectures = classes.filter(cls => 
    cls.attended === false || cls.attended === undefined
  );
  
  const missedBySubject = {};
  missedLectures.forEach(cls => {
    if (!missedBySubject[cls.subject]) {
      missedBySubject[cls.subject] = [];
    }
    missedBySubject[cls.subject].push({
      date: cls.day,
      time: cls.time,
      topic: cls.topic || "General Lecture"
    });
  });

  Object.entries(missedBySubject).forEach(([subject, lectures]) => {
    if (lectures.length > 0) {
      gaps.push({
        type: "missed_lectures",
        subject,
        severity: lectures.length > 2 ? "high" : "medium",
        count: lectures.length,
        details: lectures,
        insight: `You missed ${lectures.length} ${subject} lecture${lectures.length > 1 ? 's' : ''}`,
        priority: calculatePriority(lectures.length, "missed_lectures")
      });
    }
  });
  */

  // 2. Analyze low quiz/test scores
  if (quizScores && quizScores.length > 0) {
    const lowScores = quizScores.filter(quiz =>
      quiz.score < 60 || (quiz.maxScore && (quiz.score / quiz.maxScore) < 0.6)
    );

    const lowScoresBySubject = {};
    lowScores.forEach(quiz => {
      if (!lowScoresBySubject[quiz.subject]) {
        lowScoresBySubject[quiz.subject] = [];
      }
      lowScoresBySubject[quiz.subject].push({
        topic: quiz.topic || quiz.assignmentName,
        score: quiz.score,
        maxScore: quiz.maxScore || 100,
        date: quiz.date
      });
    });

    Object.entries(lowScoresBySubject).forEach(([subject, scores]) => {
      const avgScore = scores.reduce((sum, s) => sum + (s.score / (s.maxScore || 100)), 0) / scores.length;
      gaps.push({
        type: "low_scores",
        subject,
        severity: avgScore < 0.5 ? "high" : "medium",
        avgScore: (avgScore * 100).toFixed(1),
        count: scores.length,
        details: scores,
        insight: `Low performance in ${subject}: ${(avgScore * 100).toFixed(1)}% average`,
        priority: calculatePriority(avgScore * 100, "low_scores")
      });
    });
  }

  // 3. Analyze pending/overdue assignments
  if (assignments && assignments.length > 0) {
    const now = new Date();
    const overdue = assignments.filter(assignment => {
      if (!assignment.dueDate) return false;
      const dueDate = new Date(assignment.dueDate);
      return dueDate < now && !assignment.completed;
    });

    const pending = assignments.filter(assignment => {
      if (!assignment.dueDate) return assignment.status === "pending";
      const dueDate = new Date(assignment.dueDate);
      const daysUntilDue = (dueDate - now) / (1000 * 60 * 60 * 24);
      return !assignment.completed && daysUntilDue > 0 && daysUntilDue <= 3;
    });

    if (overdue.length > 0) {
      gaps.push({
        type: "overdue_assignments",
        severity: "high",
        count: overdue.length,
        details: overdue,
        insight: `You have ${overdue.length} overdue assignment${overdue.length > 1 ? 's' : ''}`,
        priority: 10 // Highest priority
      });
    }

    if (pending.length > 0) {
      gaps.push({
        type: "pending_assignments",
        severity: "medium",
        count: pending.length,
        details: pending,
        insight: `You have ${pending.length} assignment${pending.length > 1 ? 's' : ''} due soon`,
        priority: 7
      });
    }
  }

  // 4. Identify weak subjects (combination of missed lectures + low scores)
  const subjectWeakness = {};
  gaps.forEach(gap => {
    if (gap.subject) {
      if (!subjectWeakness[gap.subject]) {
        subjectWeakness[gap.subject] = {
          missedLectures: 0,
          lowScores: 0,
          totalIssues: 0
        };
      }
      if (gap.type === "missed_lectures") {
        subjectWeakness[gap.subject].missedLectures += gap.count;
      }
      if (gap.type === "low_scores") {
        subjectWeakness[gap.subject].lowScores += gap.count;
      }
      subjectWeakness[gap.subject].totalIssues += gap.count;
    }
  });

  Object.entries(subjectWeakness).forEach(([subject, weakness]) => {
    if (weakness.totalIssues >= 3) {
      gaps.push({
        type: "weak_subject",
        subject,
        severity: weakness.totalIssues >= 5 ? "high" : "medium",
        missedLectures: weakness.missedLectures,
        lowScores: weakness.lowScores,
        insight: `${subject} needs attention: ${weakness.missedLectures} missed lectures, ${weakness.lowScores} low scores`,
        priority: calculatePriority(weakness.totalIssues, "weak_subject")
      });
    }
  });

  // Sort by priority (highest first)
  return gaps.sort((a, b) => (b.priority || 0) - (a.priority || 0));
};

function calculatePriority(value, type) {
  switch (type) {
    case "missed_lectures":
      return value * 2; // 2 points per missed lecture
    case "low_scores":
      return (100 - value) / 10; // Higher priority for lower scores
    case "weak_subject":
      return value * 1.5;
    default:
      return 5;
  }
}

// Map free time to most relevant academic gap
export const mapFreeTimeToGap = (freeTimeSlot, gaps) => {
  if (!gaps || gaps.length === 0) return null;

  // Prioritize gaps based on:
  // 1. Exam proximity (if available)
  // 2. Subject match with previous/next class
  // 3. Gap severity
  // 4. Free time duration match

  let bestMatch = null;
  let bestScore = 0;

  gaps.forEach(gap => {
    let score = gap.priority || 0;

    // Bonus if subject matches previous or next class
    if (gap.subject) {
      if (gap.subject === freeTimeSlot.context.previousSubject) {
        score += 5;
      }
      if (gap.subject === freeTimeSlot.context.nextSubject) {
        score += 3;
      }
    }

    // Bonus for high severity
    if (gap.severity === "high") {
      score += 3;
    }

    // Consider time needed for the gap
    if (gap.type === "overdue_assignments") {
      // Overdue assignments need immediate attention
      score += 10;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = gap;
    }
  });

  return bestMatch;
};
