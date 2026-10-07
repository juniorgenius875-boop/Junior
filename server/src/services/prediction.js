import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelPath = path.resolve(__dirname, '../../model/student_performance_model.json');
const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));

function numeric(value) {
  if (value === '' || value === null || value === undefined) return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function vectorFromPayload(data = {}) {
  const aliases = {
    'math score': ['math score', 'math_score'],
    'reading score': ['reading score', 'reading_score'],
    'writing score': ['writing score', 'writing_score'],
    'Internal Test 1 (out of 40)': ['Internal Test 1 (out of 40)', 'internal_test_1'],
    'Internal Test 2 (out of 40)': ['Internal Test 2 (out of 40)', 'internal_test_2'],
    'Assignment Score (out of 10)': ['Assignment Score (out of 10)', 'assignment_score'],
    'Attendance (%)': ['Attendance (%)', 'attendance'],
    'Daily Study Hours': ['Daily Study Hours', 'study_hours'],
  };
  const values = model.numeric_features.map(name => {
    const keys = aliases[name] || [name];
    const found = keys.find(k => data[k] !== undefined);
    return numeric(found ? data[found] : undefined);
  });
  // The original Python code runs get_dummies on a single-row frame with drop_first=True.
  // That produces no categorical dummy for the single value, then reindex fills it with 0.
  while (values.length < model.feature_columns.length) values.push(0);
  return values.map((v, i) => Number.isFinite(v) ? v : Number(model.imputer_statistics[i] || 0));
}

function regression(x) {
  const scaled = x.map((v, i) => (v - model.regression.scaler_mean[i]) / (model.regression.scaler_scale[i] || 1));
  return model.regression.intercept + scaled.reduce((sum, v, i) => sum + v * model.regression.coef[i], 0);
}

function treeProbability(tree, x) {
  let node = 0;
  while (tree.children_left[node] !== -1 && tree.children_right[node] !== -1) {
    const feature = tree.feature[node];
    node = x[feature] <= tree.threshold[node] ? tree.children_left[node] : tree.children_right[node];
  }
  const counts = tree.value[node] || [0, 0];
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  return counts.map(v => v / total);
}

function classification(x) {
  const sums = model.classification.classes.map(() => 0);
  for (const tree of model.classification.trees) {
    const p = treeProbability(tree, x);
    p.forEach((v, i) => { sums[i] += v; });
  }
  return sums.map(v => v / model.classification.trees.length);
}

export function predict(data) {
  const x = vectorFromPayload(data);
  const finalMarks = regression(x);
  const probabilities = classification(x);
  const fail = Number(probabilities[0] || 0);
  const pass = Number(probabilities[1] || 0);
  const risk = fail > 0.6 ? 'High' : fail > 0.3 ? 'Medium' : 'Low';
  return {
    final_marks_prediction: Number(finalMarks.toFixed(2)),
    final_pass_prediction: pass >= 0.5 ? 1 : 0,
    final_pass_probability: Number(pass.toFixed(4)),
    final_fail_probability: Number(fail.toFixed(4)),
    risk_level: risk,
  };
}

function flags(data) {
  const pick = (...keys) => {
    const key = keys.find(k => data[k] !== undefined);
    return numeric(key ? data[key] : undefined);
  };
  const math = pick('math score', 'math_score');
  const read = pick('reading score', 'reading_score');
  const write = pick('writing score', 'writing_score');
  const it1 = pick('Internal Test 1 (out of 40)', 'internal_test_1');
  const it2 = pick('Internal Test 2 (out of 40)', 'internal_test_2');
  const att = pick('Attendance (%)', 'attendance');
  const study = pick('Daily Study Hours', 'study_hours');
  return {
    math_weak: Number.isFinite(math) && math < 50,
    reading_weak: Number.isFinite(read) && read < 50,
    writing_weak: Number.isFinite(write) && write < 50,
    internal_low: Number.isFinite(it1) && Number.isFinite(it2) && ((it1 + it2) / 2) < 20,
    attendance_low: Number.isFinite(att) && att < 60,
    study_low: Number.isFinite(study) && study < 1.5,
    math_strong: Number.isFinite(math) && math >= 75,
    reading_strong: Number.isFinite(read) && read >= 75,
    writing_strong: Number.isFinite(write) && write >= 75,
  };
}

export function recommend(data) {
  const prediction = predict(data);
  const f = flags(data);
  let topics = [];
  let interventions = [];
  if (prediction.risk_level === 'High') {
    topics = ['High Priority Revision Set', 'Redo Wrong Questions Pack', 'Daily Target Practice (30 mins)', 'Fundamental Skill Reinforcement'];
    interventions = ['Teacher Intervention Required', 'Strict Weekly Learning Plan', 'Daily micro-practice tasks'];
  } else {
    for (const [key, list] of Object.entries(model.topic_map)) {
      if (f[key]) {
        topics.push(...list);
        if (model.intervention_map[key]) interventions.push(model.intervention_map[key]);
      }
    }
    for (const [key, list] of Object.entries(model.advanced_topic_map)) if (f[key]) topics.push(...list);
    if (!topics.length) topics.push(...(model.risk_reco[prediction.risk_level] || model.general_topics));
  }
  return {
    risk_level: prediction.risk_level,
    fail_probability: prediction.final_fail_probability,
    recommended_topics: [...new Set(topics)],
    recommended_interventions: [...new Set(interventions)],
  };
}

export const predictionModelInfo = { featureColumns: model.feature_columns, trees: model.classification.trees.length };
