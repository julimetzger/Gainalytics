"""Count user data in a .gains export or in the pre-install backup slices.
usage: counts.py export.gains | counts.py --backup <backup_dir>"""
import json, sys, hashlib
def load():
    if sys.argv[1] == '--backup':
        d = sys.argv[2]
        return {k: json.load(open(f'{d}/slice_{k}.json')) for k in ['exercises', 'workouts', 'trainings', 'trainingsPlan', 'videoAnalyses', 'settings']}
    return json.load(open(sys.argv[1]))
s = load()
w, t = s['workouts'], s['trainings']
fin = [x for x in t['byId'].values() if x.get('state') == 'F']
out = {
    'exercises': len(s['exercises']['allIds']),
    'trainings': len(t['allIds']),
    'trainings_byId': len(t['byId']),
    'trainings_by_state': {st: sum(1 for x in t['byId'].values() if x.get('state') == st) for st in sorted({x.get('state') for x in t['byId'].values()})},
    'workouts_allIds': len(w['allIds']),
    'workouts_byId': len(w['byId']),
    'sets_total': sum(len(x.get('sets') or []) for x in w['byId'].values()),
    'trainingsPlans': len(s['trainingsPlan']['allIds']),
    'videoAnalyses': len(s['videoAnalyses']['allIds']),
    'max_training_id': max(int(k) for k in t['byId'] if str(k).isdigit()),
}
# content fingerprints (order-independent) of the user-relevant data
def fp(o): return hashlib.sha256(json.dumps(o, sort_keys=True).encode()).hexdigest()[:16]
out['fp_trainings_byId'] = fp(t['byId'])
out['fp_workouts_byId'] = fp(w['byId'])
out['fp_trainingsPlan_byId'] = fp(s['trainingsPlan']['byId'])
out['fp_exercises_byId'] = fp(s['exercises']['byId'])
out['fp_workouts_byExerciseId'] = fp(w.get('byExerciseId'))
out['fp_workouts_allIds'] = fp(sorted(w['allIds'], key=str))
out['fp_workouts_plannedWorkouts'] = fp(w.get('plannedWorkouts'))
out['fp_trainings_allIds'] = fp(sorted(t['allIds'], key=str))
out['fp_videoAnalyses'] = fp(s['videoAnalyses'])
if 'settings' in s: out['fp_settings'] = fp(s['settings'])
print(json.dumps(out, indent=1))
