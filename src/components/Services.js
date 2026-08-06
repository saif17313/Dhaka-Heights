import React from 'react';

const servicesData = [
  {
    icon: 'fa-cubes',
    title: 'Glass Facade & Acoustics',
    text: 'Double-glazed soundproof glass elements that reflect solar heat, minimizing air-conditioning load while offering stunning city views.'
  },
  {
    icon: 'fa-elevator',
    title: 'High-Speed Lifts',
    text: 'Sigma/Otis destination-controlled smart passenger and service elevators that ensure zero wait times during peak corporate rush hours.'
  },
  {
    icon: 'fa-shield-halved',
    title: 'Smart Security Systems',
    text: '24/7 CCTV surveillance, automated license plate readers, fire-safe emergency stairwells, and strict access-control turnstiles.'
  },
  {
    icon: 'fa-bolt',
    title: '100% Power Backup',
    text: 'Industrial-grade synchronizing diesel generators that switch instantly during outage, guaranteeing zero interruptions for business operations.'
  },
  {
    icon: 'fa-square-parking',
    title: 'Multi-level Basement Parking',
    text: 'Spacious and secure basement parking layers equipped with modern exhaust fans, car wash setups, and EV charging points.'
  },
  {
    icon: 'fa-couch',
    title: 'Elegant Executive Lounges',
    text: 'Bespoke concierge-managed lobbies with marble finishes and comfortable waiting areas, ensuring a high-status first impression for clients.'
  }
];

export default function Services() {
  return (
    <section id="services" className="services-section scroll-reveal">
      <div className="container">
        {/* Section Header */}
        <div className="section-center-header">
          <span className="section-tag">BESPOKE SERVICES</span>
          <h2 className="section-title">Designed for Seamless Operations</h2>
          <p className="section-desc">Our commercial towers incorporate state-of-the-art facilities that minimize operational friction and maximize corporate efficiency.</p>
        </div>

        {/* Services Grid */}
        <div className="services-grid">
          {servicesData.map((service, idx) => (
            <div key={idx} className="service-card">
              <div className="service-icon">
                <i className={`fa-solid ${service.icon}`}></i>
              </div>
              <h3 className="service-title">{service.title}</h3>
              <p className="service-text">{service.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
