<<<<<<< HEAD

Focus_Flow
=======

FocusFlow 🎯⚡
Personal AI/ML Learning Productivity Tracker — Built with Python + Flask

A full-featured productivity web app designed for engineering students focused on AI/ML. Track tasks, run Pomodoro sessions, set learning goals, and keep a daily journal — all in one dark-mode dashboard.

✨ Features
Feature	Description
✅ Daily Task Manager	Add tasks with category, priority, due date/time, and tags
⏱️ Focus Timer	Pomodoro (25m), Deep Work (50m), and break modes with ring animation
🚀 Learning Goals	Set goals with progress sliders, target dates, and resource links
📓 Daily Journal	Reflection notes with mood tracker saved per day
📊 Dashboard	Live stats — streak, focus time, overdue tasks, goals progress
🔔 Reminders	Browser notifications when tasks are due within 30 minutes
📚 Learning Roadmap	Personalized AI/ML roadmap — VTU student → NVIDIA/Google intern
⚙️ Setup Guide	One-click install commands, GitHub push guide, LinkedIn template
🛠️ Tech Stack
Python 3.10+ Flask 3.0 SQLAlchemy SQLite HTML5 CSS3 Vanilla JS

🚀 Quick Start
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/focusflow.git
cd focusflow

# 2. Install dependencies
pip install flask flask-sqlalchemy

# 3. Run the app
python app.py

# 4. Open in browser
# http://localhost:5000
Install Full ML Stack (optional)
pip install -r static/requirements.txt
📁 Project Structure
focusflow/
├── app.py                  # Flask app + REST API + SQLAlchemy models
├── templates/
│   └── index.html          # Single-page app template
├── static/
│   ├── css/style.css       # Dark theme styling
│   ├── js/app.js           # All frontend logic
│   └── requirements.txt    # Full ML stack dependencies
├── instance/
│   └── focusflow.db        # SQLite database (auto-created)
├── .gitignore
└── README.md
📸 Screenshots
Add screenshots here after running the app locally.

🗺️ Roadmap
 Export tasks to CSV
 Weekly focus time chart
 Google Calendar sync
 Dark/light theme toggle
 Mobile PWA support
👨‍💻 Author
Akshay — 1st Year AI/ML Engineering Student
Sir M. Visvesvaraya Institute of Technology, Bangalore | VTU

LinkedIn GitHub

📄 License
MIT License — free to use, modify, and share.

17ade29 (feat: FocusFlow productivity tracker)
