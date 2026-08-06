BEGIN;

-- Sample published customer reviews so the Media Center "Customer Reviews"
-- tab has content out of the box. All rows are ordinary rows in the
-- customer_reviews table and can be edited, unpublished, or deleted from
-- Admin -> Media & Articles -> Customer Reviews like any other review.
INSERT INTO customer_reviews (
    slug, customer_name, customer_designation, customer_location, customer_type,
    review_category, related_project, review_text, rating, review_date,
    status, is_featured, sort_order
) VALUES
(
    'kamrul-hasan-bd-palace',
    'Md. Kamrul Hasan',
    'Software Engineer',
    'Dhanmondi, Dhaka',
    'Apartment Buyer',
    'Apartment Purchase',
    'Dhaka Heights BD Palace',
    'From booking to handover, the Dhaka Heights team kept every promise on the brochure. The construction quality at BD Palace is genuinely premium, and the sales team never once pressured us — they just answered questions honestly. Two years in, we still feel we made the right choice.',
    5,
    '2026-06-12',
    'published',
    true,
    10
),
(
    'nasreen-akter-land-partnership',
    'Nasreen Akter',
    'Landowner, Bashundhara',
    'Bashundhara, Dhaka',
    'Landowner',
    'Land Development Partnership',
    'Dhaka Heights Pinnacle',
    'Handing over our family land for joint development was a difficult decision, but Dhaka Heights made the entire process transparent — every clause of the agreement was explained in person before we signed anything. Our share of Pinnacle turned out even better than the initial renderings.',
    5,
    '2026-05-03',
    'published',
    true,
    20
),
(
    'farhan-chowdhury-ariana-lofts',
    'Farhan Chowdhury',
    'Businessman',
    'Gulshan, Dhaka',
    'Investor',
    'Investment Experience',
    'Dhaka Heights Ariana Lofts',
    'I bought two units at Ariana Lofts purely as an investment, and the resale value has already appreciated well beyond what I expected. Their after-sales team is also responsive whenever I need documentation for financing — that reliability matters a lot for investors.',
    4,
    '2026-04-18',
    'published',
    false,
    30
),
(
    'shirin-sultana-sunsplash',
    'Shirin Sultana',
    'Homemaker',
    'Uttara, Dhaka',
    'Apartment Buyer',
    'Family Home',
    'Dhaka Heights Sunsplash',
    'We visited several projects before choosing Sunsplash, and the natural light and cross-ventilation in the show unit sold us instantly. The handover was only two weeks behind the original schedule, which our broker told us is unusually punctual for this market.',
    5,
    '2026-03-22',
    'published',
    false,
    40
),
(
    'tanvir-ahmed-silver-spring',
    'Tanvir Ahmed',
    'Garments Exporter',
    'Banani, Dhaka',
    'Apartment Buyer',
    'Customer Service',
    'Dhaka Heights Silver Spring',
    'What stood out to me was how the maintenance and facility management team continued to be responsive well after we moved in — most developers disappear after handover. Silver Spring still feels well managed a year later.',
    4,
    '2026-02-09',
    'published',
    false,
    50
),
(
    'abdul-malek-mazumder-palace',
    'Abdul Malek',
    'Retired Government Official',
    'Mirpur, Dhaka',
    'Other',
    'Referral Experience',
    'Dhaka Heights Mazumder Palace',
    'My son bought his first apartment at Mazumder Palace on my recommendation after I saw how well Dhaka Heights handled a relative''s land development deal. The legal team was thorough about verifying every document before registration, which gave our whole family peace of mind.',
    5,
    '2026-01-15',
    'published',
    false,
    60
)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
