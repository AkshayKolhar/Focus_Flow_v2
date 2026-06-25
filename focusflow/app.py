from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, date, timedelta
import json
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'focusflow-secret-2024'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///focusflow.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# ───────────────────────────── MODELS ─────────────────────────────

class Task(db.Model):
    id          = db.Column(db.Integer, primary_key=True)
    title       = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default='')
    category    = db.Column(db.String(50), default='study')
    priority    = db.Column(db.String(20), default='medium')
    due_date    = db.Column(db.Date, nullable=True)
    due_time    = db.Column(db.String(10), default='')
    completed   = db.Column(db.Boolean, default=False)
    completed_at= db.Column(db.DateTime, nullable=True)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)
    tags        = db.Column(db.String(200), default='')

    def to_dict(self):
        overdue = (self.due_date and self.due_date < date.today() and not self.completed)
        return {
            'id':           self.id,
            'title':        self.title,
            'description':  self.description or '',
            'category':     self.category or 'study',
            'priority':     self.priority or 'medium',
            'due_date':     self.due_date.isoformat() if self.due_date else '',
            'due_time':     self.due_time or '',
            'completed':    self.completed,
            'completed_at': self.completed_at.isoformat() if self.completed_at else '',
            'created_at':   self.created_at.isoformat(),
            'tags':         self.tags or '',
            'is_overdue':   overdue,
        }


class LearningGoal(db.Model):
    id          = db.Column(db.Integer, primary_key=True)
    title       = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default='')
    target_date = db.Column(db.Date, nullable=True)
    progress    = db.Column(db.Integer, default=0)
    resources   = db.Column(db.Text, default='[]')
    completed   = db.Column(db.Boolean, default=False)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        try:
            res = json.loads(self.resources or '[]')
        except Exception:
            res = []
        return {
            'id':          self.id,
            'title':       self.title,
            'description': self.description or '',
            'target_date': self.target_date.isoformat() if self.target_date else '',
            'progress':    self.progress or 0,
            'resources':   res,
            'completed':   self.completed,
            'created_at':  self.created_at.isoformat(),
        }


class FocusSession(db.Model):
    id               = db.Column(db.Integer, primary_key=True)
    duration_minutes = db.Column(db.Integer, default=25)
    task_label       = db.Column(db.String(200), default='')
    started_at       = db.Column(db.DateTime, default=datetime.utcnow)
    completed        = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id':               self.id,
            'duration_minutes': self.duration_minutes,
            'task_label':       self.task_label or '',
            'started_at':       self.started_at.isoformat(),
            'completed':        self.completed,
        }


class DailyNote(db.Model):
    id         = db.Column(db.Integer, primary_key=True)
    note_date  = db.Column(db.Date, default=date.today)
    content    = db.Column(db.Text, default='')
    mood       = db.Column(db.String(20), default='neutral')
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':         self.id,
            'note_date':  self.note_date.isoformat(),
            'content':    self.content or '',
            'mood':       self.mood or 'neutral',
            'updated_at': self.updated_at.isoformat(),
        }


# ───────────────────────────── ROUTES ─────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


# ── Tasks ──────────────────────────────────────────────────────────

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    category       = request.args.get('category', '')
    show_completed = request.args.get('completed', 'false').lower() == 'true'
    q = Task.query
    if not show_completed:
        q = q.filter_by(completed=False)
    if category and category != 'all':
        q = q.filter_by(category=category)
    tasks = q.order_by(Task.completed.asc(), Task.created_at.desc()).all()
    return jsonify([t.to_dict() for t in tasks])


@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.get_json(force=True, silent=True) or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'Title is required'}), 400
    task = Task(
        title       = title,
        description = data.get('description', ''),
        category    = data.get('category', 'study'),
        priority    = data.get('priority', 'medium'),
        due_time    = data.get('due_time', ''),
        tags        = data.get('tags', ''),
    )
    raw_date = data.get('due_date', '')
    if raw_date:
        try:
            task.due_date = date.fromisoformat(raw_date)
        except ValueError:
            pass
    db.session.add(task)
    db.session.commit()
    return jsonify(task.to_dict()), 201


@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    task = Task.query.get_or_404(task_id)
    data = request.get_json(force=True, silent=True) or {}
    for field in ['title', 'description', 'category', 'priority', 'tags', 'due_time']:
        if field in data:
            setattr(task, field, data[field])
    if 'due_date' in data:
        try:
            task.due_date = date.fromisoformat(data['due_date']) if data['due_date'] else None
        except ValueError:
            task.due_date = None
    if 'completed' in data:
        task.completed    = bool(data['completed'])
        task.completed_at = datetime.utcnow() if data['completed'] else None
    db.session.commit()
    return jsonify(task.to_dict())


@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    task = Task.query.get_or_404(task_id)
    db.session.delete(task)
    db.session.commit()
    return jsonify({'deleted': True})


# ── Goals ──────────────────────────────────────────────────────────

@app.route('/api/goals', methods=['GET'])
def get_goals():
    goals = LearningGoal.query.order_by(
        LearningGoal.completed.asc(), LearningGoal.created_at.desc()
    ).all()
    return jsonify([g.to_dict() for g in goals])


@app.route('/api/goals', methods=['POST'])
def create_goal():
    data = request.get_json(force=True, silent=True) or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'Title is required'}), 400
    goal = LearningGoal(
        title       = title,
        description = data.get('description', ''),
        progress    = int(data.get('progress', 0) or 0),
        resources   = json.dumps(data.get('resources', [])),
    )
    raw_date = data.get('target_date', '')
    if raw_date:
        try:
            goal.target_date = date.fromisoformat(raw_date)
        except ValueError:
            pass
    db.session.add(goal)
    db.session.commit()
    return jsonify(goal.to_dict()), 201


@app.route('/api/goals/<int:goal_id>', methods=['PUT'])
def update_goal(goal_id):
    goal = LearningGoal.query.get_or_404(goal_id)
    data = request.get_json(force=True, silent=True) or {}
    for field in ['title', 'description']:
        if field in data:
            setattr(goal, field, data[field])
    if 'progress' in data:
        goal.progress = int(data['progress'] or 0)
    if 'completed' in data:
        goal.completed = bool(data['completed'])
    if 'target_date' in data:
        try:
            goal.target_date = date.fromisoformat(data['target_date']) if data['target_date'] else None
        except ValueError:
            goal.target_date = None
    if 'resources' in data:
        goal.resources = json.dumps(data['resources'])
    db.session.commit()
    return jsonify(goal.to_dict())


@app.route('/api/goals/<int:goal_id>', methods=['DELETE'])
def delete_goal(goal_id):
    goal = LearningGoal.query.get_or_404(goal_id)
    db.session.delete(goal)
    db.session.commit()
    return jsonify({'deleted': True})


# ── Sessions ───────────────────────────────────────────────────────

@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    sessions = FocusSession.query.order_by(
        FocusSession.started_at.desc()
    ).limit(30).all()
    return jsonify([s.to_dict() for s in sessions])


@app.route('/api/sessions', methods=['POST'])
def create_session():
    data = request.get_json(force=True, silent=True) or {}
    s = FocusSession(
        duration_minutes = int(data.get('duration_minutes', 25) or 25),
        task_label       = data.get('task_label', ''),
        completed        = bool(data.get('completed', False)),
    )
    db.session.add(s)
    db.session.commit()
    return jsonify(s.to_dict()), 201


# ── Notes ──────────────────────────────────────────────────────────

@app.route('/api/notes/today', methods=['GET'])
def get_today_note():
    note = DailyNote.query.filter_by(note_date=date.today()).first()
    if not note:
        note = DailyNote(note_date=date.today())
        db.session.add(note)
        db.session.commit()
    return jsonify(note.to_dict())


@app.route('/api/notes/today', methods=['PUT'])
def update_today_note():
    note = DailyNote.query.filter_by(note_date=date.today()).first()
    if not note:
        note = DailyNote(note_date=date.today())
        db.session.add(note)
    data = request.get_json(force=True, silent=True) or {}
    if 'content' in data:
        note.content = data['content']
    if 'mood' in data:
        note.mood = data['mood']
    note.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(note.to_dict())


# ── Stats ──────────────────────────────────────────────────────────

@app.route('/api/stats', methods=['GET'])
def get_stats():
    today    = date.today()
    week_ago = today - timedelta(days=7)

    completed_today = Task.query.filter(
        Task.completed == True,
        db.func.date(Task.completed_at) == today
    ).count()
    pending = Task.query.filter_by(completed=False).count()
    overdue = Task.query.filter(
        Task.completed == False,
        Task.due_date < today
    ).count()

    sessions_today = FocusSession.query.filter(
        db.func.date(FocusSession.started_at) == today,
        FocusSession.completed == True
    ).all()
    focus_today = sum(s.duration_minutes for s in sessions_today)

    goals_active = LearningGoal.query.filter_by(completed=False).count()
    goals_done   = LearningGoal.query.filter_by(completed=True).count()

    # streak
    streak = 0
    check  = today
    for _ in range(365):
        n = Task.query.filter(
            Task.completed == True,
            db.func.date(Task.completed_at) == check
        ).count()
        if n > 0:
            streak += 1
            check  -= timedelta(days=1)
        else:
            break

    return jsonify({
        'completed_today': completed_today,
        'pending':         pending,
        'overdue':         overdue,
        'focus_minutes_today': focus_today,
        'goals_active':    goals_active,
        'goals_done':      goals_done,
        'streak':          streak,
    })


# ───────────────────────────── INIT ───────────────────────────────

with app.app_context():
    db.create_all()

if __name__ == '__main__':
    print("\n✅ FocusFlow is running!")
    print("👉 Open this in your browser: http://localhost:5000\n")
    app.run(debug=True, port=5000)
