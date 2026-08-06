import React from 'react';

const landmarks = [
  {
    time: '1 Min Walk',
    title: 'Financial Districts',
    desc: 'Surrounded by corporate offices, leading commercial bank branches, and ATM booths.'
  },
  {
    time: '5 Mins Drive',
    title: 'Gulshan Avenue',
    desc: 'Proximity to Dhaka\'s main corporate avenue, offering easy transit for team meetings.'
  },
  {
    time: '5 Mins Walk',
    title: 'Elite Shopping',
    desc: 'Located adjacent to premium shopping malls and international standard dining hubs.'
  },
  {
    time: '10 Mins Drive',
    title: 'Purbachal Expressway',
    desc: 'Easy road connectivity to Jolshiri Abashon and key transit links across Dhaka.'
  }
];

export default function Neighborhood() {
  return (
    <section className="neighborhood-section scroll-reveal">
      <div className="container grid-2">
        {/* Left Side: neighbourhood overview */}
        <div className="neighborhood-overview">
          <span className="section-tag">PRIME LOCATION</span>
          <h2 className="section-title">Bashundhara R/A Advantage</h2>
          <p className="about-lead">Positioned in the premium residential and commercial hub of Bashundhara R/A, providing unmatched lifestyle convenience.</p>
          <p className="about-text">Bashundhara Residential Area stands as the modern epicenter of residential prestige in Dhaka, serving as a landmark address for luxury developments. The area provides robust infrastructural connectivity, high security, and a prestigious community network.</p>
          <p className="about-text">With direct access to major transit lines and the Purbachal Expressway, properties of Dhaka Heights Properties Limited are perfectly located to optimize daily convenience and family living.</p>
        </div>

        {/* Right Side: landmarks grid */}
        <div className="landmarks-grid grid-2">
          {landmarks.map((landmark, idx) => (
            <div key={idx} className="landmark-card">
              <span className="landmark-time">{landmark.time}</span>
              <h3 className="landmark-title">{landmark.title}</h3>
              <p className="landmark-desc">{landmark.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
