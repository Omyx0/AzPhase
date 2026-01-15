# 🧪 Testing Guide - Smart Features

## Quick Start

### 1. Start the Server
```bash
cd server
node index.js
```
✅ You should see: `🚀 Server running on http://localhost:5000`

### 2. Start the Client
```bash
cd client
npm run dev
```
✅ You should see the app running (usually `http://localhost:5173`)

---

## 📋 Feature Testing Checklist

### ✅ 1. Smart Free-Time Detection Engine

**How to Test:**
1. Go to **Timetable** page or **Dashboard**
2. Add some classes with time gaps between them
3. Mark a class as "cancelled"
4. Navigate to **Dashboard** (main page)

**What to Look For:**
- You should see a section called **"🧠 Smart Free-Time Detection"**
- Cards showing:
  - Free time duration (e.g., "47 min free")
  - Start and end times
  - Location (Campus/Hostel/Home)
  - Workload level (High/Medium/Low)
  - Type badge (Cancelled/Gap)

**Expected Output Example:**
```
47 min free (2:00 PM - 2:47 PM)
Location: Campus • Workload: High
[Cancelled] badge
```

**If it doesn't show:**
- Make sure you have classes in your timetable
- Check browser console for errors (F12)
- Verify classes have `userId` matching your account

---

### ✅ 2. Academic Gap Analyzer

**How to Test:**
1. Add some classes to your timetable
2. Mark some classes as "not attended" (attended: false)
3. Add some assignments (in Teacher Dashboard or directly in Firestore)
4. Go to **Dashboard**

**What to Look For:**
- In the **Free-Time Detection** section, free time slots should show recommendations
- Look for cards with: **"📚 Recommended: [gap insight]"**
- Example: "📚 Recommended: You missed 2 OS lectures on Deadlock"

**To Test Different Gap Types:**

**A. Missed Lectures:**
- Add classes with `attended: false` in Firestore
- Or update timetable: `{ attended: false }`

**B. Low Scores:**
- You'll need to add quiz/test data to Firestore collection `quizScores`:
```javascript
{
  userId: "your-user-id",
  subject: "DBMS",
  topic: "Normalization",
  score: 45,
  maxScore: 100,
  date: "2025-01-15"
}
```

**C. Overdue Assignments:**
- Add assignment with past due date:
```javascript
{
  userId: "your-user-id",
  assignmentName: "Database Project",
  dueDate: "2025-01-10", // Past date
  completed: false,
  subject: "DBMS"
}
```

**Expected Output:**
- Free time slots should automatically map to relevant gaps
- Priority-based recommendations (overdue assignments highest priority)

---

### ✅ 3. Smart Peer Collaboration Matcher

**How to Test:**
1. Create multiple user accounts (or ask friends to join)
2. Each user should have:
   - Classes in their timetable
   - Some overlapping free time slots
   - Same subjects

**What to Look For:**
- On Dashboard, scroll to **"Study Partners"** section
- Should see cards with:
  - Partner's name/email
  - Match score (e.g., "Match: 75%")
  - Available together time slots
  - Common subjects badges
  - Suggested activities buttons

**Expected Output Example:**
```
[Avatar] John Doe
john@example.com
Match: 65%

Available Together:
- 2:00 PM (30 min)

Common Subjects:
[DBMS] [OS]

Suggested Activities:
[Group revision] [Doubt solving]
```

**If no matches:**
- Make sure other users have classes scheduled
- Check that free time slots overlap
- Verify users have common subjects

---

### ✅ 4. Learning Continuity Dashboard

**How to Test:**
1. Start some Focus Timer sessions (on Dashboard)
2. Complete study sessions
3. Navigate to **Analytics** page OR check the **Learning Continuity Dashboard** on Dashboard

**What to Look For:**
- **Productive Time %** metric
- **Gaps Closed** count
- **Daily Streak** (flame icon)
- **Weekly Growth** percentage
- Weekly progress chart (7-day bar chart)
- Academic growth indicator

**To Generate Data:**
- Use **Focus Timer** to create study sessions
- Sessions are automatically saved to `study_sessions` collection
- Or manually add to Firestore:
```javascript
{
  userId: "your-user-id",
  subject: "DBMS",
  durationMinutes: 45,
  timestamp: new Date(),
  date: "2025-01-15",
  gapClosed: true // If you closed a gap
}
```

**Expected Metrics:**
- Productive Time: Shows % of free time utilized
- Gaps Closed: Number of sessions that closed gaps
- Daily Streak: Consecutive days with study sessions
- Weekly Growth: % change vs last week

---

### ✅ 5. Context-Aware Smart Notifications

**How to Test:**
1. Look for the **bell icon** (🔔) in the top-right of Dashboard header
2. Mark a class as cancelled (in Teacher Dashboard or Firestore)
3. Wait for notification to appear

**What to Look For:**
- **Bell icon** with red badge showing unread count
- Click bell to see notifications panel
- Notifications should show:
  - "📅 Class cancelled: [Subject] at [Time]"
  - "→ [Duration] min free"
  - "→ Revise [Subject/Gap]"

**To Trigger Notifications:**

**A. Class Cancellation:**
```javascript
// In Firestore, update timetable document:
{
  isCancelled: true,
  notified: false // Must be false to trigger
}
```

**B. Upcoming Class (15 min before):**
- Set a class time that's 15 minutes from now
- Notification should appear automatically

**Expected Behavior:**
- Notifications appear in real-time
- Color-coded by priority (high/medium/low)
- Can be dismissed with X button
- Can mark as read
- Maximum 10 notifications stored

---

## 🔍 Debugging & Verification

### Check Browser Console (F12)
Look for any errors or warnings:
- ✅ Success: No red errors
- ❌ Error: Check error messages and report

### Check Firestore Database
1. Go to Firebase Console
2. Check collections:
   - `timetable` - Should have your classes
   - `assignments` - For gap analysis
   - `study_sessions` - For continuity metrics
   - `users` - Your user profile

### Verify Real-time Updates
1. Open app in browser
2. Open Firestore console in another tab
3. Update a document (e.g., mark class as cancelled)
4. Check if UI updates automatically (should update within 1-2 seconds)

---

## 🎯 Quick Test Script

### Minimal Test Setup:

1. **Add Test Classes:**
```javascript
// In Firestore > timetable collection, add:
{
  userId: "your-user-id",
  subject: "Operating Systems",
  day: "Monday",
  time: "10:00 AM",
  room: "Lab 101",
  isCancelled: false,
  attended: true
}

{
  userId: "your-user-id",
  subject: "DBMS",
  day: "Monday",
  time: "11:30 AM", // 90 min gap from OS
  room: "Lab 102",
  isCancelled: false,
  attended: false // Missed lecture
}
```

2. **Refresh Dashboard**
   - Should see free-time detection showing 90 min gap
   - Should see gap recommendation for missed OS lecture

3. **Add Study Session:**
   - Use Focus Timer for 30 minutes
   - Check Analytics page
   - Should see session recorded

---

## 📊 Expected UI Layout

### Dashboard Should Show (in order):
1. Header with Smart Notifications bell
2. Smart Study Hub (Classroom Sync + Academic Manager + AI Advisor)
3. Metrics Cards (Total/Active/Cancelled)
4. Your Schedule list
5. **🧠 Smart Free-Time Detection** (NEW)
6. **Learning Continuity Dashboard** (NEW)
7. **Study Partners** (NEW)
8. Focus Timer

---

## 🐛 Common Issues & Solutions

### Issue: "No free time detected"
**Solution:**
- Ensure classes have proper time format: "10:00 AM"
- Check classes are on the same day
- Verify time gaps are 15+ minutes

### Issue: "No gaps found"
**Solution:**
- Mark some classes as `attended: false`
- Add assignments with past due dates
- Check browser console for errors

### Issue: "No study partners"
**Solution:**
- Need multiple users with overlapping schedules
- Ensure other users have classes in Firestore
- Check `userClassesMap` is populated

### Issue: "Notifications not showing"
**Solution:**
- Check class has `notified: false`
- Refresh page after marking class as cancelled
- Check browser console for errors

### Issue: "Dashboard not loading"
**Solution:**
- Check Firebase connection
- Verify user is logged in
- Check browser console for Firebase errors
- Verify Firestore rules allow read access

---

## ✅ Verification Checklist

- [ ] Server running on port 5000
- [ ] Client running on port 5173
- [ ] User logged in successfully
- [ ] Classes visible in timetable
- [ ] Free-time detection showing gaps/cancelled classes
- [ ] Academic gaps being detected and mapped
- [ ] Study partners section visible (even if empty)
- [ ] Continuity dashboard showing metrics
- [ ] Notifications bell visible in header
- [ ] Focus Timer working
- [ ] No console errors

---

## 🚀 Next Steps After Testing

1. **Add Real Data:** Import actual class schedule
2. **Invite Users:** Get friends/classmates to join for collaboration
3. **Track Progress:** Use Focus Timer regularly to build streaks
4. **Review Gaps:** Regularly check and close academic gaps
5. **Use Notifications:** Enable notifications for best experience

---

## 📞 Need Help?

If features aren't working:
1. Check browser console (F12) for errors
2. Verify Firebase configuration in `firebase.js`
3. Check Firestore database rules
4. Verify API keys are set in `.env` files
5. Check network tab for failed API calls

All features are **real-time** - changes in Firestore should reflect immediately in the UI!
