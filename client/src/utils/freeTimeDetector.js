/**
 * Smart Free-Time Detection Engine
 * Detects free time slots with academic context (location, previous/next subject, workload)
 */

export const detectFreeTime = (classes, currentTime = new Date()) => {
  const freeTimeSlots = [];
  const today = currentTime.toLocaleDateString('en-US', { weekday: 'long' });
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  
  // Filter today's classes
  const todayClasses = classes
    .filter(cls => cls.day === today)
    .sort((a, b) => parseTime(a.time) - parseTime(b.time));

  // Helper to parse time string to minutes
  function parseTime(timeStr) {
    const [time, period] = timeStr.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    let hour24 = hours;
    if (period === 'PM' && hours !== 12) hour24 += 12;
    if (period === 'AM' && hours === 12) hour24 = 0;
    return hour24 * 60 + (minutes || 0);
  }

  // Helper to calculate duration between two times
  function getDurationMinutes(startTime, endTime) {
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    return end - start;
  }

  // Detect gaps between consecutive classes
  for (let i = 0; i < todayClasses.length - 1; i++) {
    const currentClass = todayClasses[i];
    const nextClass = todayClasses[i + 1];
    
    if (!currentClass.isCancelled) {
      const currentEnd = parseTime(currentClass.time) + (currentClass.duration || 60); // Default 60 min class
      const nextStart = parseTime(nextClass.time);
      const gapMinutes = nextStart - currentEnd;
      
      if (gapMinutes >= 15) { // At least 15 minutes gap
        freeTimeSlots.push({
          freeTimeDuration: gapMinutes,
          unit: "minutes",
          startTime: formatTime(currentEnd),
          endTime: nextClass.time,
          context: {
            location: currentClass.room || "Campus",
            previousSubject: currentClass.subject,
            nextSubject: nextClass.subject,
            dayWorkloadLevel: calculateWorkloadLevel(todayClasses),
            previousRoom: currentClass.room,
            nextRoom: nextClass.room
          },
          type: "gap"
        });
      }
    }
  }

  // Detect cancelled classes (sudden free slots)
  const cancelledClasses = todayClasses.filter(cls => cls.isCancelled);
  cancelledClasses.forEach(cls => {
    const classStart = parseTime(cls.time);
    const classDuration = cls.duration || 60;
    const classEnd = classStart + classDuration;
    
    // Find next class
    const nextClass = todayClasses.find(c => 
      !c.isCancelled && parseTime(c.time) > classStart
    );
    
    // Only include if it's current or future time
    const nowMinutes = currentHour * 60 + currentMinute;
    if (classStart >= nowMinutes - 30) { // Include if within 30 min past or future
      freeTimeSlots.push({
        freeTimeDuration: classDuration,
        unit: "minutes",
        startTime: cls.time,
        endTime: formatTime(classEnd),
        context: {
          location: cls.room || "Campus",
          previousSubject: todayClasses[todayClasses.indexOf(cls) - 1]?.subject || "None",
          nextSubject: nextClass?.subject || "None",
          dayWorkloadLevel: calculateWorkloadLevel(todayClasses),
          cancelledSubject: cls.subject,
          originalRoom: cls.room
        },
        type: "cancelled"
      });
    }
  });

  // Sort by start time
  return freeTimeSlots.sort((a, b) => 
    parseTime(a.startTime) - parseTime(b.startTime)
  );
};

function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
  return `${hour12}:${mins.toString().padStart(2, '0')} ${period}`;
}

function calculateWorkloadLevel(classes) {
  const activeClasses = classes.filter(c => !c.isCancelled).length;
  if (activeClasses >= 5) return "High";
  if (activeClasses >= 3) return "Medium";
  return "Low";
}

// Get current free time slot (if any)
export const getCurrentFreeTime = (classes) => {
  const freeSlots = detectFreeTime(classes);
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const nowMinutes = currentHour * 60 + currentMinute;

  return freeSlots.find(slot => {
    const start = parseTime(slot.startTime);
    const end = parseTime(slot.endTime || slot.startTime) + slot.freeTimeDuration;
    return nowMinutes >= start && nowMinutes <= end;
  });
};

function parseTime(timeStr) {
  if (!timeStr) return 0;
  const [time, period] = timeStr.split(' ');
  const [hours, minutes] = time.split(':').map(Number);
  let hour24 = hours;
  if (period === 'PM' && hours !== 12) hour24 += 12;
  if (period === 'AM' && hours === 12) hour24 = 0;
  return hour24 * 60 + (minutes || 0);
}
