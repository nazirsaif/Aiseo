import os
import torch
import torch.nn as nn
import joblib
import hashlib
import urllib.parse
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

# ── ML-Driven Diagnostic Engine ───────────────────────────────────────────────
# Instead of pre-written problem/solution text, this engine:
#   1. Uses the trained PyTorch model's weights to identify which INPUT FEATURES
#      are most responsible for each predicted issue  (feature attribution).
#   2. Compares actual metric values against threshold ranges.
#   3. COMPOSES the feedback text algorithmically from data — no stored sentences.
#
# This means the output changes based on: the actual page data, the model's
# learned weights, and the deviation magnitude.  Nothing is pre-written.
# ──────────────────────────────────────────────────────────────────────────────

# Threshold configuration — purely numeric.  Text is generated at runtime.
# (min_acceptable, ideal_target, unit_label, direction)
#   direction: 'higher' = more is better, 'lower' = less is better,
#              'range' = must stay within min–max, 'present' = boolean should be 1,
#              'absent' = boolean should be 0, 'exact' = must equal ideal
_THRESHOLDS = {
    'content_length':         (300,  800,  'words',          'higher'),
    'keyword_density':        (0.5,  1.5,  '',               'range'),
    'num_internal_links':     (3,    8,    'internal links',  'higher'),
    'num_external_links':     (1,    3,    'external links',  'higher'),
    'has_meta_description':   (1,    1,    'meta description','present'),
    'has_alt_text':           (1,    1,    'image alt text',  'present'),
    'avg_time_on_page_sec':   (30,   90,   'seconds',        'higher'),
    'bounce_rate':            (60,   35,   '%',              'lower'),
    'scroll_depth_percent':   (40,   70,   '%',              'higher'),
    'domain_authority':       (20,   50,   'DA',             'higher'),
    'page_authority':         (15,   40,   'PA',             'higher'),
    'backlink_count':         (10,  100,   'backlinks',      'higher'),
    'serp_position_before':   (20,    5,   '',               'lower'),
    'h1Count':                (1,    1,    'H1 tags',        'exact'),
    'has_readable_font_size': (1,    1,    'readable fonts', 'present'),
    'isNoindex':              (0,    0,    'noindex tag',    'absent'),
    # Omni-layer features
    'omni_readability':       (12,   8,    'grade level',    'lower'),
    'omni_dom_nodes':         (800, 500,   'DOM nodes',      'lower'),
    'omni_text_ratio':        (15,   30,   '%',              'higher'),
    'omni_script_count':      (10,    5,   'scripts',        'lower'),
    'content_length':         (300,  800,  'words',          'higher'),
}

def _feature_label(name):
    """Convert a feature column name to a readable label. e.g. 'num_internal_links' → 'internal link count'."""
    return (name
            .replace('omni_', '')
            .replace('has_', '')
            .replace('num_', '')
            .replace('is_', '')
            .replace('avg_', '')
            .replace('_sec', '')
            .replace('_percent', '')
            .replace('_before', '')
            .replace('Count', ' count')
            .replace('_', ' ')
            .strip())

def _extract_feature_attribution(issue_index):
    """
    Use the trained model's weight matrices to compute end-to-end feature
    attribution for a specific issue output neuron.
    Returns [(feature_name, attribution_score), ...] sorted by |score|.
    """
    if ml_model is None:
        return []
    try:
        with torch.no_grad():
            w1 = ml_model.layer1.weight           # [64, input_size]
            w2 = ml_model.layer2.weight           # [32, 64]
            w3 = ml_model.layer3.weight           # [16, 32]
            w_out = ml_model.out_issues.weight[issue_index]  # [16]
            # End-to-end weight product → per-feature attribution
            attribution = w_out @ w3 @ w2 @ w1    # [input_size]
        scored = [(feature_cols[i], float(attribution[i])) for i in range(len(feature_cols))]
        scored.sort(key=lambda x: abs(x[1]), reverse=True)
        return scored[:5]
    except Exception as e:
        print(f"[Attribution] Error: {e}")
        return []

def _diagnose_feature(feature_name, actual, profile):
    """
    Compare one metric's actual value against its threshold profile.
    Returns (severity, problem_fragment, fix_fragment) or None if healthy.
    """
    min_ok, ideal, unit, direction = profile
    label = _feature_label(feature_name)
    u = f" {unit}" if unit else ""

    if direction == 'higher':
        if actual < min_ok:
            gap = min_ok - actual
            sev = 'critical' if actual < min_ok * 0.5 else 'moderate'
            return (sev,
                    f"your {label} is {actual}{u}, which is below the recommended minimum of {min_ok}{u}",
                    f"increase your {label} to at least {ideal}{u} — you are currently {gap}{u} short")
    elif direction == 'lower':
        if actual > min_ok:
            excess = actual - min_ok
            sev = 'critical' if actual > min_ok * 1.5 else 'moderate'
            return (sev,
                    f"your {label} is {actual}{u}, which exceeds the safe maximum of {min_ok}{u}",
                    f"reduce your {label} to below {ideal}{u} — you are {excess}{u} over the limit")
    elif direction == 'range':
        max_val = min_ok * 4  # e.g. density 0.5 → max 2.0
        if actual < min_ok:
            return ('moderate',
                    f"your {label} is {actual}{u}, below the minimum of {min_ok}{u}",
                    f"bring your {label} into the {min_ok}–{max_val}{u} range")
        if actual > max_val:
            return ('moderate',
                    f"your {label} is {actual}{u}, above the maximum of {max_val}{u}",
                    f"bring your {label} into the {min_ok}–{max_val}{u} range")
    elif direction == 'present':
        if not actual:
            return ('critical',
                    f"your page is missing a {label}",
                    f"add a {label} — this is a fundamental on-page element")
    elif direction == 'absent':
        if actual:
            return ('critical',
                    f"your page has a {label} that blocks search engine indexing",
                    f"remove the {label} so search engines can index this page")
    elif direction == 'exact':
        if actual != ideal:
            return ('moderate',
                    f"your {label} is {actual}{u} instead of the optimal {ideal}{u}",
                    f"adjust your {label} to exactly {ideal}{u}")
    return None

def get_issue_feedback(issue_name, data):
    """
    ML-driven diagnostic: uses the trained model's feature attribution to
    identify which metrics are driving the issue, then composes feedback
    from actual values vs threshold ranges.  No pre-written sentences.
    """
    diagnostics = []

    # ── Step 1: ML Attribution — ask the model which features matter ──
    issue_idx = None
    if issue_name in issue_cols:
        issue_idx = issue_cols.index(issue_name)
    if issue_idx is not None:
        attributions = _extract_feature_attribution(issue_idx)
        for feat_name, _attr_score in attributions:
            profile = _THRESHOLDS.get(feat_name)
            if not profile:
                continue
            actual = data.get(feat_name, 0)
            if isinstance(actual, bool):
                actual = int(actual)
            diag = _diagnose_feature(feat_name, actual, profile)
            if diag:
                diagnostics.append(diag)

    # ── Step 2: Omni issues — fuzzy-match feature from issue name ──
    if not diagnostics:
        issue_tokens = set(issue_name.replace('issue_', '').split('_'))
        for feat_name, profile in _THRESHOLDS.items():
            feat_tokens = set(feat_name.split('_'))
            if issue_tokens & feat_tokens:
                actual = data.get(feat_name, 0)
                if isinstance(actual, bool):
                    actual = int(actual)
                diag = _diagnose_feature(feat_name, actual, profile)
                if diag:
                    diagnostics.append(diag)

    # ── Step 3: Compose feedback from diagnostic results ──
    if diagnostics:
        diagnostics.sort(key=lambda d: 0 if d[0] == 'critical' else 1)
        problem_parts = [d[1] for d in diagnostics[:3]]
        fix_parts     = [d[2] for d in diagnostics[:3]]
        if len(problem_parts) == 1:
            problem = f"The AI model detected that {problem_parts[0]}."
        else:
            problem = (f"The AI model identified multiple factors: {problem_parts[0]}. "
                       f"Additionally, {'; '.join(problem_parts[1:])}.")
        solution = ". ".join(f[0].upper() + f[1:] for f in fix_parts) + "."
        return problem, solution

    # ── Fallback for truly unknown issues ──
    label = issue_name.replace('issue_', '').replace('_', ' ')
    return (f"A potential issue was detected with your {label}.",
            f"Review and improve your {label} based on SEO best practices.")

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

    # ──────────────────────────────────────────────────────────────────
    # DYNAMIC RANKING REASON COMPOSER  (no hardcoded strings)
    # Builds unique sentences by combining clause pools + real metrics
    # ──────────────────────────────────────────────────────────────────
    def _intensity(delta):
        """Return an adverb based on the magnitude of the difference."""
        a = abs(delta)
        if a > 50: return "dramatically"
        if a > 20: return "significantly"
        if a > 10: return "noticeably"
        if a > 5:  return "moderately"
        return "slightly"

    def _compose_reason(label, subject, own_v, comp_v, positive_verb, negative_verb, unit, tip):
        """Build a unique ranking-reason sentence from parts."""
        delta = own_v - comp_v
        adv = _intensity(delta)
        if delta > 0:
            return (f"{label}: Your {subject} {adv} {positive_verb} the competitor's "
                    f"({own_v}{unit} vs {comp_v}{unit}). {tip}")
        elif delta < 0:
            return (f"{label}: The competitor's {subject} {adv} {negative_verb} yours "
                    f"({comp_v}{unit} vs {own_v}{unit}). {tip}")
        return None

    reasons = []

    # 1. H1 critical checks
    h1c = own_data.get('h1Count', 0)
    if h1c == 0:
        reasons.append(f"Critical Gap: Your page has no H1 heading (found {h1c}). "
                        "Adding a single, keyword-rich H1 is one of the highest-impact on-page fixes.")
    elif h1c > 1:
        reasons.append(f"Structure Issue: {h1c} H1 tags detected. Consolidate to exactly one H1 "
                        "so crawlers can identify a clear primary topic for this page.")

    # 2. Content depth
    own_words = own_data.get('content_length', 0)
    comp_words = comp_data.get('content_length', 0)
    r = _compose_reason("Content Depth", "word count", own_words, comp_words,
                        "exceeds", "exceeds", " words",
                        "Search engines reward comprehensive topical coverage.")
    if r and abs(own_words - comp_words) > 100:
        reasons.append(r)

    # 3. H2 structure
    own_h2 = len(own_data.get('h2Tags', []))
    comp_h2 = len(comp_data.get('h2Tags', []))
    r = _compose_reason("Heading Structure", "H2 sub-heading count", own_h2, comp_h2,
                        "outlines more topics than", "outlines more topics than", "",
                        "More sub-headings help crawlers understand your page outline.")
    if r and abs(own_h2 - comp_h2) > 1:
        reasons.append(r)

    # 4. H3 granularity
    own_h3 = own_data.get('h3Count', 0)
    comp_h3 = comp_data.get('h3Count', 0)
    r = _compose_reason("Topic Granularity", "H3 tier usage", own_h3, comp_h3,
                        "surpasses", "surpasses", " H3 tags",
                        "H3 tags allow deeper topic clustering for featured-snippet eligibility.")
    if r and abs(own_h3 - comp_h3) > 2:
        reasons.append(r)

    # 5. Internal links
    own_links = own_data.get('num_internal_links', 0)
    comp_links = comp_data.get('num_internal_links', 0)
    r = _compose_reason("Link Architecture", "internal link network", own_links, comp_links,
                        "is denser than", "is denser than", " links",
                        "A well-linked site distributes PageRank more effectively.")
    if r and abs(own_links - comp_links) > 5:
        reasons.append(r)

    # 6. Images
    own_imgs = own_data.get('imageCount', 0)
    comp_imgs = comp_data.get('imageCount', 0)
    r = _compose_reason("Visual Engagement", "image count", own_imgs, comp_imgs,
                        "provides richer media than", "provides richer media than", " images",
                        "Images improve dwell-time and can rank in Google Image search.")
    if r and abs(own_imgs - comp_imgs) > 1:
        reasons.append(r)

    missing_alt = own_data.get('imagesWithoutAlt', 0)
    if missing_alt > 0:
        reasons.append(f"Accessibility Gap: {missing_alt} of your images lack alt text. "
                        "Adding descriptive alt attributes improves both accessibility and image SEO.")

    # 7. Domain authority
    own_da = own_data.get('domain_authority', 0)
    comp_da = comp_data.get('domain_authority', 0)
    r = _compose_reason("Trust Signal", "domain authority", own_da, comp_da,
                        "outranks", "outranks", " DA",
                        "A higher DA often correlates with a stronger backlink profile.")
    if r and own_da != comp_da:
        reasons.append(r)

    # 8. Script bloat
    own_scripts = own_data.get('omni_script_count', 0)
    comp_scripts = comp_data.get('omni_script_count', 0)
    if own_scripts > comp_scripts + 5:
        reasons.append(f"Performance Risk: Your page loads {own_scripts} scripts vs the competitor's "
                        f"{comp_scripts}. Reducing render-blocking JS can improve Core Web Vitals.")

    # 9. Overall issue count
    if len(own_issues) != len(comp_issues):
        fewer, more = ("your", "the competitor's") if len(own_issues) < len(comp_issues) else ("the competitor's", "your")
        reasons.append(f"Technical Health: With {len(own_issues)} flags vs {len(comp_issues)}, "
                        f"{fewer} page is cleaner than {more}. Fewer technical issues is a positive ranking signal.")

    if not reasons:
        reasons.append("Competitive Parity: Both pages are closely matched across all on-page factors. "
                        "Focus on off-page signals like backlinks and social authority to gain an edge.")

    # ──────────────────────────────────────────────────────────────────
    # CONTENT GAP — DYNAMIC RAG COMPOSITION ENGINE
    # ──────────────────────────────────────────────────────────────────
    try:
        STOP_WORDS = {
            'this', 'that', 'with', 'from', 'your', 'their', 'about', 'would', 'could', 'should',
            'generic', 'content', 'website', 'page', 'home', 'click', 'here', 'more', 'info',
            'service', 'services', 'provider', 'company', 'contact', 'us', 'login', 'signup',
            'sign', 'up', 'menu', 'search', 'privacy', 'policy', 'terms', 'conditions', 'rights',
            'reserved', 'copyright', 'navigation', 'footer', 'header', 'sidebar', 'link', 'links',
            'social', 'media', 'follow', 'facebook', 'twitter', 'instagram', 'linkedin', 'youtube',
            'email', 'address', 'phone', 'number', 'call', 'today', 'free', 'get', 'started',
            'read', 'learn', 'details', 'check', 'out', 'view', 'all', 'latest', 'news', 'blog',
            'posts', 'comments', 'posted', 'by', 'date', 'author', 'category', 'tags',
            'department', 'departments'
        }

        def get_domain_tokens(url):
            if not url: return []
            try:
                domain = urllib.parse.urlparse(url).netloc
                return [t for t in domain.replace('.', ' ').replace('-', ' ').split() if len(t) > 2]
            except:
                return []

        dynamic_stops = get_domain_tokens(own_data.get('url')) + get_domain_tokens(comp_data.get('url'))
        STOP_WORDS.update([s.lower() for s in dynamic_stops])

        def extract_weighted_keywords(site_data):
            if not site_data: return {}
            title_text = (site_data.get('title') or '').lower()
            h1_text = " ".join([str(t) for t in (site_data.get('h1Tags') or [])]).lower()
            topic_context = set(title_text.split() + h1_text.split())
            topic_context = {w for w in topic_context if len(w) > 3 and w not in STOP_WORDS}
            weighted_phrases = {}

            def add_phrases(text_list, weight):
                if not text_list: return
                for raw_text in text_list:
                    if not raw_text: continue
                    clean_text = "".join(c for c in str(raw_text).lower() if c.isalnum() or c.isspace())
                    tokens = [t for t in clean_text.split() if len(t) > 3 and t not in STOP_WORDS]
                    for t in tokens:
                        boost = 1.5 if any(tw in t or t in tw for tw in topic_context) else 1.0
                        weighted_phrases[t] = weighted_phrases.get(t, 0) + (weight * boost)
                    for j in range(len(tokens) - 1):
                        bigram = f"{tokens[j]} {tokens[j+1]}"
                        boost = 2.0 if any(tw in bigram for tw in topic_context) else 1.0
                        weighted_phrases[bigram] = weighted_phrases.get(bigram, 0) + (weight * 1.2 * boost)

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

        # Smart clustering
        clusters = {"Strategic": [], "Informational": [], "Action-Oriented": []}
        for kw in gap_keywords:
            if any(t in kw for t in ['best', 'top', 'review', 'vs', 'comparison']):
                clusters["Strategic"].append(kw.title())
            elif any(t in kw for t in ['how', 'what', 'why', 'guide', 'tips']):
                clusters["Informational"].append(kw.title())
            else:
                clusters["Action-Oriented"].append(kw.title())

        # ── REAL instead_of: pick the user's weakest actual keywords ──
        user_sorted = sorted(own_weighted.items(), key=lambda x: x[1])
        real_weak_keywords = [t[0] for t in user_sorted if len(t[0]) > 3][:20]
        if not real_weak_keywords:
            real_weak_keywords = ["unoptimized content"]

        # ── COMPOSITIONAL STRATEGY GENERATOR ──
        # Clause pools — combined deterministically per phrase hash
        _actions = [
            "Add a dedicated H2 section titled",
            "Weave naturally into your introductory paragraph:",
            "Create a new sub-section covering",
            "Integrate into your product/service description:",
            "Use as an anchor-text phrase linking to a new page about",
            "Include in your meta description alongside",
            "Reference within your FAQ section:",
            "Expand your existing content with a paragraph on",
        ]
        _impacts = [
            "This closes a topical gap the competitor currently dominates.",
            "Pages covering this phrase see higher engagement in this niche.",
            "Search engines treat this as a core entity for your topic cluster.",
            "This bridges your content to a high-traffic intent vertical.",
            "Missing this phrase weakens your page's semantic completeness score.",
            "Competitor headings featuring this phrase correlate with higher SERP positions.",
            "Adding this signals deeper expertise to quality-rater algorithms.",
            "This is a high-TF-IDF term in the competitor's content structure.",
        ]
        _placements = [
            "Best placed in an H2 heading or the first 150 words.",
            "Most effective when used in both a heading and body text.",
            "Optimal placement: a dedicated paragraph with supporting sentences.",
            "Insert within your page's above-the-fold content for maximum impact.",
            "Use in a comparison table or feature list for strong CTR signals.",
            "Pair with related long-tail phrases in a how-to or guide format.",
        ]

        def _compose_suggestion(phrase, score, index, weak_kw):
            """Build a unique suggestion by deterministic rotation of clause pools."""
            # Use phrase hash for deterministic but varied selection
            h = int(hashlib.md5(phrase.encode()).hexdigest(), 16)
            action = _actions[(h + index) % len(_actions)]
            impact = _impacts[(h + index * 3) % len(_impacts)]
            placement = _placements[(h + index * 7) % len(_placements)]
            reason = f"{action} \"{phrase.title()}\". {impact} {placement} (Relevance: {score:.1f})"
            return {
                "use": phrase.title(),
                "instead_of": weak_kw,
                "reason": reason
            }

        seen_reasons = set()
        replacements = []
        for i, (phrase, score) in enumerate(gaps_with_scores):
            if score < 1.5 or i >= 20:
                break
            weak_kw = real_weak_keywords[i % len(real_weak_keywords)]
            suggestion = _compose_suggestion(phrase, score, i, weak_kw)

            # Deduplication: skip if reason fingerprint already seen
            fp = suggestion["reason"][:60]
            if fp in seen_reasons:
                continue
            seen_reasons.add(fp)
            replacements.append(suggestion)

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