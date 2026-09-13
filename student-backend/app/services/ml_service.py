import pickle
from pathlib import Path
from typing import Dict
import numpy as np
import pandas as pd


class MLService:
    def __init__(self):
        self.artifacts: dict = {}

    def load(self, artifact_path: str | Path):
        with open(artifact_path, 'rb') as handle:
            artifacts = pickle.load(handle)

        self.artifacts = {
            'df_full': artifacts['df'],
            'classification_model': artifacts['classification_model'],
            'regression_model': artifacts['regression_model'],
            'imputer': artifacts['imputer'],
            'topic_map': artifacts['topic_map'],
            'advanced_topic_map': artifacts['advanced_topic_map'],
            'intervention_map': artifacts['intervention_map'],
            'risk_reco': artifacts['risk_reco'],
            'general_topics': artifacts['general_topics'],
            'numeric_features': artifacts['numeric_features'],
            'categorical_features': artifacts['categorical_features'],
        }

        df_full = self.artifacts['df_full']
        cat_features = self.artifacts['categorical_features']
        num_features = self.artifacts['numeric_features']
        df_encoded = pd.get_dummies(df_full[cat_features], drop_first=True)
        x_full = pd.concat(
            [df_full[num_features].reset_index(drop=True), df_encoded.reset_index(drop=True)],
            axis=1,
        )
        self.artifacts['X_full_columns'] = x_full.columns

    @property
    def ready(self) -> bool:
        return bool(self.artifacts)

    def prepare_input(self, data: Dict) -> pd.DataFrame:
        artifacts = self.artifacts
        input_df = pd.DataFrame([data])
        cat_feats = artifacts['categorical_features']
        num_feats = artifacts['numeric_features']
        full_cols = artifacts['X_full_columns']

        for col in cat_feats:
            if col not in input_df.columns:
                input_df[col] = 'Missing'

        df_encoded = pd.get_dummies(input_df[cat_feats], drop_first=True)
        input_df = input_df.drop(columns=cat_feats, errors='ignore')

        for col in num_feats:
            if col not in input_df.columns:
                input_df[col] = np.nan

        input_df = input_df.filter(num_feats)
        x_input = pd.concat(
            [
                input_df.reset_index(drop=True),
                df_encoded.reindex(columns=full_cols.difference(num_feats), fill_value=0),
            ],
            axis=1,
        )
        return x_input[full_cols]

    def predict(self, data: Dict) -> dict:
        x_input = self.prepare_input(data)
        x_imputed_array = self.artifacts['imputer'].transform(x_input)
        x_imputed = pd.DataFrame(x_imputed_array, columns=x_input.columns)

        final_marks = float(self.artifacts['regression_model'].predict(x_imputed)[0])
        probabilities = self.artifacts['classification_model'].predict_proba(x_imputed)[0]
        fail_proba = float(probabilities[0])
        pass_proba = float(probabilities[1])
        pass_pred = int(pass_proba >= 0.5)

        if fail_proba > 0.6:
            risk = 'High'
        elif fail_proba > 0.3:
            risk = 'Medium'
        else:
            risk = 'Low'

        return {
            'final_marks_prediction': round(final_marks, 2),
            'final_pass_prediction': pass_pred,
            'final_pass_probability': round(pass_proba, 4),
            'final_fail_probability': round(fail_proba, 4),
            'risk_level': risk,
        }

    @staticmethod
    def _compute_skill_flags(row):
        def g(key):
            return row.get(key, np.nan)

        math = g('math score')
        read = g('reading score')
        write = g('writing score')
        it1 = g('Internal Test 1 (out of 40)')
        it2 = g('Internal Test 2 (out of 40)')
        att = g('Attendance (%)')
        study = g('Daily Study Hours')

        return {
            'math_weak': math < 50 if pd.notna(math) else False,
            'reading_weak': read < 50 if pd.notna(read) else False,
            'writing_weak': write < 50 if pd.notna(write) else False,
            'internal_low': ((it1 + it2) / 2) < 20 if pd.notna(it1) and pd.notna(it2) else False,
            'attendance_low': att < 60 if pd.notna(att) else False,
            'study_low': study < 1.5 if pd.notna(study) else False,
            'math_strong': math >= 75 if pd.notna(math) else False,
            'reading_strong': read >= 75 if pd.notna(read) else False,
            'writing_strong': write >= 75 if pd.notna(write) else False,
        }

    def recommend(self, data: Dict) -> dict:
        prediction = self.predict(data)
        row = {**data, **self._compute_skill_flags(data), 'risk_level': prediction['risk_level']}
        topics: list[str] = []
        interventions: list[str] = []

        if row['risk_level'] == 'High':
            topics = [
                'High Priority Revision Set',
                'Redo Wrong Questions Pack',
                'Daily Target Practice (30 mins)',
                'Fundamental Skill Reinforcement',
            ]
            interventions = [
                'Teacher Intervention Required',
                'Strict Weekly Learning Plan',
                'Daily micro-practice tasks',
            ]
        else:
            for weakness, mapped_topics in self.artifacts['topic_map'].items():
                if row.get(weakness) is True:
                    topics.extend(mapped_topics)
                    interventions.append(self.artifacts['intervention_map'][weakness])

            for strength, mapped_topics in self.artifacts['advanced_topic_map'].items():
                if row.get(strength) is True:
                    topics.extend(mapped_topics)

            if not topics:
                topics.extend(
                    self.artifacts['risk_reco'].get(row['risk_level'], self.artifacts['general_topics'])
                )

        return {
            'risk_level': row['risk_level'],
            'fail_probability': prediction['final_fail_probability'],
            'recommended_topics': list(dict.fromkeys(topics)),
            'recommended_interventions': list(dict.fromkeys(interventions)),
        }


ml_service = MLService()
