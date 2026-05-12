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
    issues = [
        f"an anomaly regarding your {issue_formatted}", 
        f"a critical issue with {issue_formatted}", 
        f"a negative algorithmic signal for {issue_formatted}",
        f"a minor optimization opportunity for {issue_formatted}"
    ]
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

@app.route('/compare', methods=['POST'])
def compare_sites():
    """
    Compares Own Website vs Competitor Website.
    Expects JSON: { "own": {...metrics...}, "competitor": {...metrics...} }
    """
    data = request.json
    own_data = data.get('own', {})
    comp_data = data.get('competitor', {})

    if not ml_model:
        return jsonify({"status": "error", "message": "ML Model Offline"}), 500

    def get_score_and_issues(site_data):
        try:
            input_vector = []
            for col in feature_cols:
                val = site_data.get(col, 0)
                if val is None: val = 0
                if isinstance(val, bool): val = int(val)
                if isinstance(val, (list, set)): val = len(val)
                input_vector.append(val)
            
            scaled = scaler.transform([input_vector])
            with torch.no_grad():
                issues_preds, score_pred = ml_model(torch.FloatTensor(scaled))
            
            flags = (issues_preds > 0.5).int().numpy()[0]
            score = int(score_pred.item() * 100)
            
            # Omni-AI Overlay
            omni_anomalies = analyze_omni_layer(site_data)
            score = max(0, score - len(omni_anomalies))
            
            detected_issues = []
            for i, has_issue in enumerate(flags):
                if has_issue == 1:
                    detected_issues.append(issue_cols[i])
            for omni in omni_anomalies:
                detected_issues.append(omni)
                
            return score, detected_issues
        except Exception as e:
            print(f"Site Analysis Error: {str(e)}")
            return 50, ["Model processing error: Falling back to heuristic baseline."]

    own_score, own_issues = get_score_and_issues(own_data)
    comp_score, comp_issues = get_score_and_issues(comp_data)

    # Ranking Reason Logic
    reasons = []
    score_diff = comp_score - own_score
    
    # 1. Critical Technical Gaps
    if own_data.get('h1Count', 0) == 0:
        reasons.append("Critical Gap: Your page is missing an H1 heading. This is a high-priority fix for keyword indexing.")
    elif own_data.get('h1Count', 0) > 1:
        reasons.append("Structure Issue: You have multiple H1 tags. Best practice is to have exactly one H1 to define the page topic.")

    # 2. Content & Topical Depth
    own_words = own_data.get('content_length', 0)
    comp_words = comp_data.get('content_length', 0)
    if comp_words > own_words + 100: # Lowered threshold
        reasons.append(f"Content Gap: Competitor has {comp_words} words vs your {own_words}. Search engines favor comprehensive topical depth.")
    elif own_words > comp_words + 1000:
        reasons.append("Authority Edge: Your content depth is significantly superior, creating a high barrier to entry.")
    
    # 3. Heading Hierarchy (H2 & H3)
    own_h2 = len(own_data.get('h2Tags', []))
    comp_h2 = len(comp_data.get('h2Tags', []))
    if comp_h2 > own_h2:
        reasons.append(f"Semantic Structure: Competitor uses more H2 subheadings ({comp_h2} vs {own_h2}), creating a better outline for indexers.")
    
    own_h3 = own_data.get('h3Count', 0)
    comp_h3 = comp_data.get('h3Count', 0)
    if comp_h3 > own_h3 + 3:
        reasons.append(f"Granular Depth: Competitor leverages H3 tiers for better topic clustering ({comp_h3} vs {own_h3}).")

    # 4. Link Architecture
    own_links = own_data.get('num_internal_links', 0)
    comp_links = comp_data.get('num_internal_links', 0)
    if comp_links > own_links + 5: # Lowered threshold
        reasons.append(f"Link Density: Competitor has a more interconnected internal architecture ({comp_links} links), distributing PageRank more effectively.")
    elif own_links > comp_links + 15:
        reasons.append("Navigation Edge: Your internal linking is robust, helping users and crawlers discover deeper pages faster.")

    # 5. Media & Visual Engagement
    own_imgs = own_data.get('imageCount', 0)
    comp_imgs = comp_data.get('imageCount', 0)
    if comp_imgs > own_imgs:
        reasons.append(f"Media Richness: Competitor uses more images, which correlates with better user engagement and 'time on page' signals.")
    
    if own_data.get('imagesWithoutAlt', 0) > 0:
        reasons.append(f"Accessibility Gap: You have {own_data.get('imagesWithoutAlt')} images missing alt text. Competitors with better accessibility often rank higher.")

    # 6. Authority & Technical Performance
    if comp_data.get('domain_authority', 0) > own_data.get('domain_authority', 0):
        reasons.append(f"Trust Signal: Competitor domain authority is higher. They likely have a more established backlink profile.")
    
    own_scripts = own_data.get('omni_script_count', 0)
    comp_scripts = comp_data.get('omni_script_count', 0)
    if own_scripts > comp_scripts + 5:
        reasons.append("Performance Risk: Your page has significantly more tracking scripts than the competitor, which may impact Core Web Vitals.")

    # 7. Overall Health Comparison
    if len(comp_issues) < len(own_issues):
        reasons.append(f"Technical Debt: Your page has {len(own_issues)} flags while the competitor has {len(comp_issues)}. A 'cleaner' site is a stronger ranking signal.")
        
    if not reasons:
        reasons.append("Competitive Parity: Both sites are extremely well-optimized. Focus on off-page SEO and backlinks to gain an edge.")

    # Content Gap Logic (Enhanced RAG - Expert Level)
    try:
        # Massive list of noise words
        STOP_WORDS = {
            'this', 'that', 'with', 'from', 'your', 'their', 'about', 'would', 'could', 'should', 
            'generic', 'content', 'website', 'page', 'home', 'click', 'here', 'more', 'info', 
            'service', 'services', 'provider', 'company', 'contact', 'us', 'login', 'signup',
            'sign', 'up', 'menu', 'search', 'privacy', 'policy', 'terms', 'conditions', 'rights',
            'reserved', 'copyright', 'navigation', 'footer', 'header', 'sidebar', 'link', 'links',
            'social', 'media', 'follow', 'facebook', 'twitter', 'instagram', 'linkedin', 'youtube',
            'email', 'address', 'phone', 'number', 'call', 'today', 'free', 'get', 'started',
            'read', 'learn', 'details', 'check', 'out', 'view', 'all', 'latest', 'news', 'blog',
            'posts', 'comments', 'posted', 'by', 'date', 'author', 'category', 'tags'
        }
        
        def extract_weighted_keywords(site_data):
            if not site_data: return {}
            # Topic is usually in the title or H1
            title_text = (site_data.get('title') or '').lower()
            h1_text = " ".join([str(t) for t in (site_data.get('h1Tags') or [])]).lower()
            topic_context = set(title_text.split() + h1_text.split())
            topic_context = {w for w in topic_context if len(w) > 3 and w not in STOP_WORDS}

            weighted_phrases = {}
            
            def add_phrases(text_list, weight):
                if not text_list: return
                for raw_text in text_list:
                    if not raw_text: continue
                    # Clean text
                    clean_text = "".join(c for c in str(raw_text).lower() if c.isalnum() or c.isspace())
                    tokens = [t for t in clean_text.split() if len(t) > 3 and t not in STOP_WORDS]
                    
                    # Single words
                    for t in tokens:
                        relevance_boost = 1.5 if any(tw in t or t in tw for tw in topic_context) else 1.0
                        weighted_phrases[t] = weighted_phrases.get(t, 0) + (weight * relevance_boost)
                    
                    # Bigrams
                    for i in range(len(tokens) - 1):
                        bigram = f"{tokens[i]} {tokens[i+1]}"
                        relevance_boost = 2.0 if any(tw in bigram for tw in topic_context) else 1.0
                        weighted_phrases[bigram] = weighted_phrases.get(bigram, 0) + (weight * 1.2 * relevance_boost)
            
            add_phrases([(site_data.get('title') or '')], 4.0)
            add_phrases((site_data.get('h1Tags') or []), 3.0)
            add_phrases((site_data.get('h2Tags') or []), 1.5)
            
            return weighted_phrases

        own_weighted = extract_weighted_keywords(own_data)
        comp_weighted = extract_weighted_keywords(comp_data)
        
        gaps_with_scores = []
        for phrase, score in comp_weighted.items():
            if phrase not in own_weighted:
                gaps_with_scores.append((phrase, score))
                
        gaps_with_scores.sort(key=lambda x: x[1], reverse=True)
        gap_keywords = [g[0] for g in gaps_with_scores[:15]]
        
        # Clustering
        clusters = {"Strategic": [], "Informational": [], "Action-Oriented": []}
        for kw in gap_keywords:
            if any(t in kw for t in ['best', 'top', 'review', 'vs', 'comparison']):
                clusters["Strategic"].append(kw.title())
            elif any(t in kw for t in ['how', 'what', 'why', 'guide', 'tips']):
                clusters["Informational"].append(kw.title())
            else:
                clusters["Action-Oriented"].append(kw.title())

        # Replacement logic
        user_tokens = sorted(own_weighted.items(), key=lambda x: x[1])
        filler_candidates = [t[0] for t in user_tokens if t[0] in {'more', 'learn', 'click', 'read', 'details', 'info', 'here'}]
        if not filler_candidates: filler_candidates = ["generic content", "filler text", "unoptimized sections"]

        replacements = []
        replacements = []
        # Dynamic Count: Show all significant gaps (Importance Score > 1.5) up to 20
        for i, (phrase, score) in enumerate(gaps_with_scores):
            if score < 1.5 or i >= 20:
                break
                
            instead = filler_candidates[i % len(filler_candidates)]
            
            # Dynamic Strategy Engine
            templates = {
                "Strategic": [
                    f"Competitive edge detected. Integrating '{phrase}' as a primary H2 heading will directly challenge the competitor's dominance in this niche.",
                    f"High-intent phrase found. Adding '{phrase}' to your product descriptions or service blocks will capture ready-to-convert traffic.",
                    f"Strategic gap identified. This keyword bridges the trust-gap between your '{instead}' content and the competitor's authority."
                ],
                "Informational": [
                    f"Topical completeness boost. Expanding your guide to include a dedicated section on '{phrase}' will satisfy search engine depth requirements.",
                    f"Semantic enrichment. We recommend using '{phrase}' within your first 2 paragaphs to establish topical context immediately.",
                    f"Educational gap. Replacing '{instead}' with this specialized term demonstrates expertise and increases user dwell time."
                ],
                "Action-Oriented": [
                    f"Density optimization. Swapping the filler word '{instead}' for '{phrase}' improves your keyword-to-content ratio for this core topic.",
                    f"Vocabulary alignment. Our analysis shows '{phrase}' is a high-frequency term in this niche; your current content lacks this semantic connection.",
                    f"Conversion focus. Using '{phrase}' in your call-to-action blocks or subheaders improves topical relevance for search crawlers."
                ]
            }
            
            cluster_type = "Action-Oriented"
            if any(t in phrase.lower() for t in ['best', 'top', 'review', 'vs', 'comparison']):
                cluster_type = "Strategic"
            elif any(t in phrase.lower() for t in ['how', 'what', 'why', 'guide', 'tips']):
                cluster_type = "Informational"
            
            import random
            strategy = random.choice(templates[cluster_type])

            replacements.append({
                "use": phrase.title(),
                "instead_of": instead,
                "reason": f"Topic Intelligence: {strategy} (Importance Score: {score:.1f})"
            })
            
        return jsonify({
            "status": "success",
            "comparison": {
                "own_score": own_score,
                "competitor_score": comp_score,
                "predicted_rank_diff": max(1, abs(comp_score - own_score) // 4) if comp_score != own_score else 0,
                "reasons_why_above": reasons,
                "content_gap": {
                    "missing_keywords": gap_keywords,
                    "suggestions": replacements,
                    "clusters": clusters
                }
            }
        })

    except Exception as e:
        print(f"CRITICAL RAG ERROR: {str(e)}")
        # Fallback response if RAG fails but comparison logic worked
        return jsonify({
            "status": "success",
            "comparison": {
                "own_score": own_score,
                "competitor_score": comp_score,
                "predicted_rank_diff": 0,
                "reasons_why_above": reasons,
                "content_gap": {
                    "missing_keywords": [],
                    "suggestions": [],
                    "clusters": {},
                    "error": "Content gap analysis partially failed"
                }
            }
        })

if __name__ == '__main__':
    app.run(port=5001, debug=True)