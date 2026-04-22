import os
import torch
import torch.nn as nn
import joblib
import random
from flask import Flask, request, jsonify

app = Flask(__name__)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 1. Neural Network Architecture (Multi-Label Classifier)
class SEOMultiIssuePredictor(nn.Module):
    def __init__(self, input_size, num_issues):
        super(SEOMultiIssuePredictor, self).__init__()
        
        self.layer1 = nn.Linear(input_size, 64)
        self.bn1 = nn.BatchNorm1d(64)
        self.relu1 = nn.ReLU()
        self.dropout1 = nn.Dropout(p=0.2)
        
        self.layer2 = nn.Linear(64, 32)
        self.bn2 = nn.BatchNorm1d(32)
        self.relu2 = nn.ReLU()
        self.dropout2 = nn.Dropout(p=0.2)
        
        self.layer3 = nn.Linear(32, 16)
        self.relu3 = nn.ReLU()
        
        self.out_issues = nn.Linear(16, num_issues)
        self.out_score = nn.Linear(16, 1)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        x = self.layer1(x)
        x = self.bn1(x)
        x = self.relu1(x)
        x = self.dropout1(x)
        
        x = self.layer2(x)
        x = self.bn2(x)
        x = self.relu2(x)
        x = self.dropout2(x)
        
        x = self.layer3(x)
        x = self.relu3(x)
        
        issues = self.sigmoid(self.out_issues(x))
        score = self.sigmoid(self.out_score(x))
        return issues, score

# 2. Load the Multi-Label Machine Learning Model and Scaler!
try:
    scaler = joblib.load(os.path.join(BASE_DIR, 'seo_issues_scaler.pkl'))
    feature_cols = joblib.load(os.path.join(BASE_DIR, 'seo_issues_features.pkl'))
    issue_cols = joblib.load(os.path.join(BASE_DIR, 'seo_issues_cols.pkl'))

    ml_model = SEOMultiIssuePredictor(input_size=len(feature_cols), num_issues=len(issue_cols))
    ml_model.load_state_dict(torch.load(os.path.join(BASE_DIR, 'seo_issues_classifier.pth')))
    ml_model.eval()
    print("[INIT] Multi-Label SEO Model successfully loaded.")
except Exception as e:
    print(f"[ERROR] Failed to load ML model dependencies: {e}")
    ml_model = None

# Dynamic Algorithmic Text Generator (No Hardcoded Dictionaries)
def get_issue_feedback(issue_name, data):
    # Parse the raw ML feature name into a readable phrase
    issue_formatted = issue_name.replace('issue_', '').replace('_', ' ').title()
    
    # Dynamically extract relevant metrics to inject
    stat = ""
    if 'content' in issue_name and 'competitor' not in issue_name: stat = f" (Current: {data.get('content_length', 0)} words)"
    elif 'internal' in issue_name: stat = f" (Current: {data.get('num_internal_links', 0)} internal links)"
    elif 'external' in issue_name: stat = f" (Current: {data.get('num_external_links', 0)} external links)"
    elif 'bounce' in issue_name: stat = f" (Current: {data.get('bounce_rate', 0)}% predicted bounce)"
    elif 'time' in issue_name: stat = f" (Current: {data.get('avg_time_on_page_sec', 0)}s predicted dwell time)"
    
    # Omni-AI Context
    elif 'readability' in issue_name: stat = f" (Current: Grade {data.get('omni_readability', 0):.1f} complexity)"
    elif 'dom' in issue_name: stat = f" (Current: {data.get('omni_dom_nodes', 0)} exact HTML nodes)"
    elif 'ratio' in issue_name: stat = f" (Current: {data.get('omni_text_ratio', 0):.1f}% content payload density)"
    elif 'payload' in issue_name: stat = f" (Current: {data.get('omni_script_count', 0)} active tracking scripts)"
    elif 'competitor' in issue_name: stat = f" (Competitor Avg: >1500 words vs Your {data.get('content_length', 0)} words)"

    # Algorithmically construct the Issue Description
    intros = ["The analysis engine detected", "Our AI model flagged", "The system identified", "Predictive algorithms found", "The crawler encountered"]
    issues = [f"an anomaly regarding your {issue_formatted}", f"a critical issue with {issue_formatted}", f"a negative algorithmic signal for {issue_formatted}"]
    msg = f"{random.choice(intros)} {random.choice(issues)}{stat}."
    
    # Algorithmically construct the Actionable Recommendation
    actions = ["It is highly recommended to", "You should immediately", "Consider taking steps to", "The best next step is to", "To improve your rank,"]
    resolutions = [
        f"optimize the {issue_formatted} to strictly align with technical SEO standards.",
        f"review your {issue_formatted} architecture and update it based on modern best practices.",
        f"make targeted improvements to {issue_formatted} to boost algorithmic trust factors.",
        f"restructure the {issue_formatted} elements to maximize crawler efficiency and user retention."
    ]
    rec = f"{random.choice(actions)} {random.choice(resolutions)}"
    
    return msg, rec

def analyze_omni_layer(data):
    """
    Hybrid Intelligence Layer operating parallel to PyTorch.
    Analyzes deep semantic NLP metrics and heavy structural DOM metrics.
    """
    omni_issues = []
    
    # 1. Competitor Contextual Issue
    competitors = data.get('omni_competitors_found', 0)
    word_count = data.get('content_length', 0)
    if competitors >= 2 and word_count < 1500:
        omni_issues.append('issue_competitor_content_gap')
        
    # 2. NLP Semantic Issue
    read_score = data.get('omni_readability', 0)
    if read_score > 12:  # College level proxy threshold
        omni_issues.append('issue_poor_nlp_readability_score')
        
    # 3. Technical DOM Issues
    dom_nodes = data.get('omni_dom_nodes', 0)
    if dom_nodes > 800:
        omni_issues.append('issue_heavy_html_dom_bloat')
        
    text_ratio = data.get('omni_text_ratio', 100)
    if text_ratio < 15:
        omni_issues.append('issue_low_text_to_html_ratio')
        
    script_count = data.get('omni_script_count', 0)
    if script_count >= 10:
        omni_issues.append('issue_excessive_javascript_payload')
        
    return omni_issues

@app.route('/analyze', methods=['POST'])
def analyze_seo():
    data = request.json 
    
    if not ml_model:
        return jsonify({"status": "error", "message": "ML Model Offline"}), 500

    # 1. Structure the input explicitly based on what model expects
    input_vector = []
    for col in feature_cols:
        val = data.get(col, 0)
        # Handle booleans as 0 or 1
        if isinstance(val, bool):
            val = int(val)
        input_vector.append(val)
        
    # Scale Data
    scaled_features = scaler.transform([input_vector])
    
    # 2. Fully Neural Network Based Inference
    with torch.no_grad():
        issues_preds, score_pred = ml_model(torch.FloatTensor(scaled_features))
    
    # Threshold at 0.5 for Sigmoid outputs => 1 (Issue Present), 0 (No Issue)
    issue_flags = (issues_preds > 0.5).int().numpy()[0]
    final_score = int(score_pred.item() * 100)
    
    # 3. Predict Projected Optimized Score (Counterfactual Simulation)
    optimized_data = dict(data)
    # Force optimization based on best practices
    optimized_data['content_length'] = max(optimized_data.get('content_length', 0), 500)
    optimized_data['has_meta_description'] = 1
    optimized_data['has_alt_text'] = 1
    optimized_data['num_internal_links'] = max(optimized_data.get('num_internal_links', 0), 5)
    optimized_data['num_external_links'] = max(optimized_data.get('num_external_links', 0), 2)
    kd = optimized_data.get('keyword_density', 0)
    if kd < 0.5 or kd > 3.0: optimized_data['keyword_density'] = 1.5
    optimized_data['bounce_rate'] = min(optimized_data.get('bounce_rate', 100), 50)
    optimized_data['avg_time_on_page_sec'] = max(optimized_data.get('avg_time_on_page_sec', 0), 60)
    optimized_data['domain_authority'] = max(optimized_data.get('domain_authority', 0), 30)
    optimized_data['h1Count'] = 1
    optimized_data['has_readable_font_size'] = 1
    optimized_data['isNoindex'] = 0

    opt_vector = []
    for col in feature_cols:
        val = optimized_data.get(col, 0)
        if isinstance(val, bool): val = int(val)
        opt_vector.append(val)
        
    opt_scaled = scaler.transform([opt_vector])
    with torch.no_grad():
        _, opt_score_pred = ml_model(torch.FloatTensor(opt_scaled))
    
    # Calculate a dynamic projected score based on ML prediction + dynamic issue resolution
    base_projected = int(opt_score_pred.item() * 100)
    
    # Scale projected score uniquely by boosting the final_score relative to how many technical issues were fixed
    issues_to_fix_count = int(issue_flags.sum())
    dynamic_boost = final_score + (issues_to_fix_count * 5)
    
    projected_score = max(base_projected, dynamic_boost)
    
    # Ensure projection is realistically bound and always superior/equal to actual
    projected_score = min(99, max(projected_score, final_score + 5))
    
    # 4. Assemble Technical Audit Dynamically
    detected_issues = []
    detected_recommendations = []
    
    for i, has_issue in enumerate(issue_flags):
        if has_issue == 1:
            issue_name = issue_cols[i]
            msg, rec = get_issue_feedback(issue_name, data)
            if msg and rec:
                detected_issues.append(msg)
                detected_recommendations.append(rec)
                
    # 5. Omni-AI Overlay (Inject Semantic/Technical NLP Issues algorithmically)
    omni_anomalies = analyze_omni_layer(data)
    for omni_flag in omni_anomalies:
        msg, rec = get_issue_feedback(omni_flag, data)
        # Apply score penalty for critical deep technical issues
        final_score = max(0, final_score - 1) 
        if msg and rec:
            detected_issues.append(msg)
            detected_recommendations.append(rec)

    audit_results = {
        "score": final_score,
        "projected_score": projected_score,
        "issues": detected_issues,
        "recommendations": detected_recommendations
    }
    
    return jsonify({
        "status": "success",
        "technical_audit": audit_results,
        "ai_prediction": {
            "pytorch_compliance_score": final_score,
            "projected_score": projected_score
        }
    })

if __name__ == '__main__':
    app.run(port=5001, debug=True)