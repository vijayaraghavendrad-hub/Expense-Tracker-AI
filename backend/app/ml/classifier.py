import re
from typing import Dict, List, Tuple
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline


# Curated seed training data covering everyday real-world expenses
SEED_DATA: List[Tuple[str, str]] = [
    # Food & Dining
    ("Starbucks iced latte and croissant", "Food & Dining"),
    ("Chipotle burrito bowl and guac", "Food & Dining"),
    ("Whole Foods grocery shopping", "Food & Dining"),
    ("Trader Joe's groceries and vegetables", "Food & Dining"),
    ("Uber Eats dinner delivery", "Food & Dining"),
    ("Doordash Thai food lunch", "Food & Dining"),
    ("McDonalds drive-thru meal", "Food & Dining"),
    ("Subway footlong sandwich", "Food & Dining"),
    ("Local Italian pizza and pasta dinner", "Food & Dining"),
    ("Sushi bar lunch special", "Food & Dining"),
    ("Supermarket fruits and dairy items", "Food & Dining"),
    ("Blue Bottle morning coffee", "Food & Dining"),
    ("Bakery fresh bread and pastries", "Food & Dining"),
    ("Taco Bell late night snack", "Food & Dining"),
    ("Burger King whopper combo", "Food & Dining"),
    ("Boba milk tea and dessert", "Food & Dining"),
    ("Grocery store weekly supplies", "Food & Dining"),
    ("Dunkin donuts and iced coffee", "Food & Dining"),
    ("KFC fried chicken bucket", "Food & Dining"),
    ("Farmers market organic produce", "Food & Dining"),

    # Travel & Transport
    ("Uber ride to downtown office", "Travel & Transport"),
    ("Lyft trip to airport terminal", "Travel & Transport"),
    ("Shell gas station fuel fill-up", "Travel & Transport"),
    ("Chevron petrol unleaded fuel", "Travel & Transport"),
    ("Subway metro monthly transit pass", "Travel & Transport"),
    ("Train ticket to New York", "Travel & Transport"),
    ("Flight tickets Delta Air Lines", "Travel & Transport"),
    ("United Airlines flight booking", "Travel & Transport"),
    ("Airport parking garage 3 days", "Travel & Transport"),
    ("Highway express toll lane tag", "Travel & Transport"),
    ("Yellow cab taxi ride", "Travel & Transport"),
    ("Hertz car rental weekend trip", "Travel & Transport"),
    ("Amtrak regional train ticket", "Travel & Transport"),
    ("City bus fare ticket", "Travel & Transport"),
    ("Bicycle repair and tuneup shop", "Travel & Transport"),
    ("Gasoline fill-up Exxon Mobil", "Travel & Transport"),

    # Shopping
    ("Amazon prime order wireless earbuds", "Shopping"),
    ("Target clothes and household decor", "Shopping"),
    ("Walmart electronics and home supplies", "Shopping"),
    ("Best Buy HDMI cable and mouse", "Shopping"),
    ("Zara winter jacket and t-shirt", "Shopping"),
    ("Nike running sneakers", "Shopping"),
    ("IKEA desk chair and shelf", "Shopping"),
    ("Apple Store iPad smart cover", "Shopping"),
    ("Sephora skincare cosmetics lotion", "Shopping"),
    ("Uniqlo casual shirts pants", "Shopping"),
    ("eBay vintage jacket purchase", "Shopping"),
    ("Barnes & Noble hardcover books", "Shopping"),
    ("Home Depot garden tools and paint", "Shopping"),
    ("Shoe Palace running trainers", "Shopping"),
    ("Glasses and sunglasses frame", "Shopping"),

    # Bills & Utilities
    ("Electric utility bill monthly power", "Bills & Utilities"),
    ("City water and sewage service", "Bills & Utilities"),
    ("High speed internet Comcast Xfinity", "Bills & Utilities"),
    ("AT&T cell phone bill monthly unlimited", "Bills & Utilities"),
    ("Verizon wireless mobile connection", "Bills & Utilities"),
    ("Natural gas heating utility bill", "Bills & Utilities"),
    ("Residential trash and waste collection", "Bills & Utilities"),
    ("WiFi broadband home bill", "Bills & Utilities"),
    ("Electricity bill ConEd", "Bills & Utilities"),
    ("Mobile prepaid plan recharge", "Bills & Utilities"),

    # Entertainment
    ("AMC theaters movie tickets and popcorn", "Entertainment"),
    ("Steam summer sale PC game download", "Entertainment"),
    ("Live concert festival tickets Ticketmaster", "Entertainment"),
    ("PlayStation Plus game purchase", "Entertainment"),
    ("Nintendo switch game cart", "Entertainment"),
    ("Bowling alley Friday night drinks", "Entertainment"),
    ("Museum entry ticket exhibition", "Entertainment"),
    ("Broadway musical play tickets", "Entertainment"),
    ("Escape room adventure with friends", "Entertainment"),
    ("Theme park amusement tickets", "Entertainment"),

    # Education
    ("Udemy full-stack python bootcamp", "Education"),
    ("Coursera machine learning certification", "Education"),
    ("University semester tuition payment", "Education"),
    ("College campus bookstore textbook", "Education"),
    ("GRE exam registration fee", "Education"),
    ("AWS certification test fee", "Education"),
    ("Academic research paper journal access", "Education"),
    ("Math tutoring session fee", "Education"),
    ("Coding masterclass subscription", "Education"),

    # Health & Wellness
    ("CVS pharmacy prescription medication", "Health & Wellness"),
    ("Walgreens allergy medicine and vitamins", "Health & Wellness"),
    ("Dental cleaning and checkup co-pay", "Health & Wellness"),
    ("Doctor office consultation copay", "Health & Wellness"),
    ("Equinox gym monthly membership fee", "Health & Wellness"),
    ("Planet Fitness gym dues", "Health & Wellness"),
    ("Optometry eye checkup and contact lenses", "Health & Wellness"),
    ("Physical therapy rehabilitation session", "Health & Wellness"),
    ("Pharmacy pain relief and first aid", "Health & Wellness"),
    ("Dermatologist skin consultation", "Health & Wellness"),

    # Rent & Housing
    ("Monthly apartment rent payment", "Rent & Housing"),
    ("Landlord residential lease payment", "Rent & Housing"),
    ("Condo HOA monthly maintenance fees", "Rent & Housing"),
    ("Home mortgage principal and interest", "Rent & Housing"),
    ("Property tax installment payment", "Rent & Housing"),
    ("Self storage monthly rental unit", "Rent & Housing"),

    # Subscriptions
    ("Netflix monthly 4k streaming plan", "Subscriptions"),
    ("Spotify Premium individual music", "Subscriptions"),
    ("GitHub Copilot developer plan", "Subscriptions"),
    ("Apple iCloud 200GB cloud storage", "Subscriptions"),
    ("Google One cloud backup subscription", "Subscriptions"),
    ("ChatGPT Plus monthly OpenAI sub", "Subscriptions"),
    ("YouTube Premium ad-free subscription", "Subscriptions"),
    ("Disney+ streaming bundle monthly", "Subscriptions"),
    ("Amazon Prime membership annual fee", "Subscriptions"),
    ("The New York Times digital news access", "Subscriptions"),
    ("Adobe Creative Cloud all apps suite", "Subscriptions"),

    # Salary & Income
    ("Bi-weekly company payroll salary deposit", "Salary & Income"),
    ("Monthly tech corporate salary direct deposit", "Salary & Income"),
    ("Freelance client web development payment", "Salary & Income"),
    ("Upwork freelance project payout", "Salary & Income"),
    ("Quarterly stock dividend payment", "Salary & Income"),
    ("Annual performance bonus payout", "Salary & Income"),
    ("Consulting invoice settlement", "Salary & Income"),
    ("High yield savings account interest payout", "Salary & Income"),
    ("Tax refund direct deposit government", "Salary & Income"),

    # Other
    ("ATM cash withdrawal cash out", "Other"),
    ("Bank monthly maintenance fee", "Other"),
    ("Peer to peer Venmo transfer to friend", "Other"),
    ("Wire transfer fee banking", "Other"),
    ("Miscellaneous small purchase", "Other"),
]


def clean_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-zA-Z0-9\s]", " ", text)
    return " ".join(text.split())


class ExpenseClassifier:
    def __init__(self):
        self.training_data: List[Tuple[str, str]] = list(SEED_DATA)
        self.model: Pipeline = Pipeline(
            [
                ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=1, max_features=2500)),
                ("clf", LogisticRegression(C=2.0, max_iter=500, random_state=42)),
            ]
        )
        self._is_trained = False
        self.train()

    def train(self):
        texts = [clean_text(item[0]) for item in self.training_data]
        labels = [item[1] for item in self.training_data]
        self.model.fit(texts, labels)
        self._is_trained = True

    def predict(self, description: str, amount: float = None) -> Dict:
        if not description or not description.strip():
            return {
                "predicted_category": "Other",
                "confidence": 0.0,
                "top_candidates": [],
            }

        cleaned = clean_text(description)
        if not self._is_trained:
            self.train()

        probabilities = self.model.predict_proba([cleaned])[0]
        classes = self.model.classes_

        prob_dict = {cat: float(prob) for cat, prob in zip(classes, probabilities)}

        # Intelligent amount contextual adjustment
        if amount is not None and amount > 0:
            if amount <= 15.0:
                # Micro expenses: boost Food & Dining / Travel / Utilities
                if "Food & Dining" in prob_dict:
                    prob_dict["Food & Dining"] *= 1.25
                if "Travel & Transport" in prob_dict:
                    prob_dict["Travel & Transport"] *= 1.15
            elif amount >= 800.0:
                # Macro expenses: boost Rent & Housing / Shopping / Education / Investments
                if "Rent & Housing" in prob_dict:
                    prob_dict["Rent & Housing"] *= 1.35
                if "Shopping" in prob_dict:
                    prob_dict["Shopping"] *= 1.20
                if "Education" in prob_dict:
                    prob_dict["Education"] *= 1.20

            # Re-normalize
            total_p = sum(prob_dict.values())
            if total_p > 0:
                prob_dict = {k: v / total_p for k, v in prob_dict.items()}

        # Pair class with probability and sort descending
        ranked = sorted(
            [{"category": cat, "confidence": float(round(prob, 4))} for cat, prob in prob_dict.items()],
            key=lambda x: x["confidence"],
            reverse=True,
        )

        top = ranked[0]
        return {
            "predicted_category": top["category"],
            "confidence": top["confidence"],
            "top_candidates": ranked[:3],
        }

    def add_feedback_and_retrain(self, description: str, actual_category: str):
        if not description or not actual_category:
            return
        # Append 3x weight for user correction
        for _ in range(3):
            self.training_data.append((description, actual_category))
        self.train()


# Global singleton instance
classifier = ExpenseClassifier()
