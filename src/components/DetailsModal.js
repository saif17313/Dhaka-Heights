'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

// Specs and details static lookups
const projectsData = {
  'dhaka-heights-ariana-lofts': {
    title: 'Dhaka Heights Ariana Lofts',
    category: 'Ongoing Development',
    location: 'Block-I, Road-15, Plot-983, Bashundhara R/A, Dhaka',
    size: '2400 SFT Available Slots',
    floors: 'G + 9 Residential Floors',
    parking: 'Ground Level Parking',
    elevators: '1 High-Speed Passenger Elevator',
    power: '100% Synchronized Generator Backup',
    description: 'Dhaka Heights Ariana Lofts is designed for modern lifestyles, combining contemporary structural features with optimized residential layouts in Block-I of Bashundhara Residential Area. The project features natural light, premium fittings, and green common areas.',
    image: '/assets/proj_ariana_lofts.png'
  },
  'dhaka-heights-mazumder-palace': {
    title: 'Dhaka Heights Mazumder Palace',
    category: 'Completed Prestige',
    location: 'Plot# 213/A, Road# 07, Block# J, Bashundhara R/A, Dhaka',
    size: '2200 - 4400 SFT Ready Apartments',
    floors: 'G + 9 Residential Floors',
    parking: '1 Basement Level (30 Cars)',
    elevators: '2 High-Speed Elevators',
    power: 'Synchronized Generator Backup',
    description: 'Delivered with absolute perfection, Dhaka Heights Mazumder Palace is a flagship completed development in Block J of Bashundhara. Known for its gorgeous glass-accented facade, spacious double-height lobby, and round-the-clock facilities management.',
    image: '/assets/proj_mazumder_palace.png'
  },
  'dhaka-heights-pinnacle': {
    title: 'Dhaka Heights Pinnacle',
    category: 'Ongoing Development',
    location: 'Jolshiri Abashon, Dhaka',
    size: '3400 SFT Premium Units',
    floors: 'G + 9 Residential Floors',
    parking: '1 Basement Level (20 Cars)',
    elevators: '2 High-Speed Elevators',
    power: 'Dual Grid Synchronized Backup',
    description: 'Standing tall as a premier residential address in Jolshiri Abashon, Dhaka Heights Pinnacle features oversized apartments with high ceilings, glass balconies overlooking the skyline, and a health club and gym for residents.',
    image: '/assets/proj_pinnacle.png'
  }
};

const newsData = {
  '1': {
    title: 'Ground Breaking Ceremony of Dhaka Heights Green Heaven',
    date: '16 February 2026',
    content: [
      'Dhaka Heights Construction Limited proudly hosted the launching ceremony of its newest project, Dhaka Heights Green Heaven.',
      'Designed as a perfect blend of serene lake views and urban greenery, this project introduces a refined lifestyle enriched with modern amenities.',
      'Honorable Managing Director along with the engineering and management team marked the groundbreaking of this residential oasis.'
    ]
  },
  '2': {
    title: 'How to choose best real estate company for flat purchase in Bashundhara R/A',
    date: 'March 15, 2026',
    content: [
      'Research the reputation of the company: Start by researching the reputation of the company you are considering. Look for information about their track record, previous projects, and customer reviews.',
      'Check if they have a good reputation for delivering quality construction and timely completion of projects. For example, Dhaka Heights Development Limited holds an outstanding record in Bashundhara Residential Area.',
      'Verify building approvals, structural safety standards, and road connectivity parameters to protect your capital investment.'
    ]
  },
  '3': {
    title: 'Top 20 real estate companies in Dhaka, Bangladesh 2023',
    date: 'March 15, 2026',
    content: [
      'Finding a reliable developer to realize their aspirations of owning a building is the dream of every landowner in Bangladesh due to the buzz surrounding this industry.',
      'Dhaka Heights Development Limited came to Bangladesh real estate market with the motto "Your Prestigious Living" in an effort to shift the narrative.',
      'Dhaka Heights Development Limited has completely redefined customer service, transparency in project schedules, and premium structural engineering standards in the capital.'
    ]
  }
};

export default function DetailsModal({ isOpen, modalType, targetId, onClose }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoTime, setVideoTime] = useState(14);
  const totalVideoTime = 150; // 2:30

  useEffect(() => {
    let interval;
    if (modalType === 'video' && isOpen && isPlaying) {
      interval = setInterval(() => {
        setVideoTime((prev) => (prev + 1) % totalVideoTime);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [modalType, isOpen, isPlaying]);

  if (!isOpen) return null;

  const handleCloseClick = () => {
    setIsPlaying(false);
    setVideoTime(14);
    if (onClose) onClose();
  };

  const handleScrollToContact = (e) => {
    e.preventDefault();
    handleCloseClick();
    setTimeout(() => {
      const element = document.getElementById('contact');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 300);
  };

  // Video render layout
  if (modalType === 'video') {
    const percent = (videoTime / totalVideoTime) * 100;
    const curMin = Math.floor(videoTime / 60);
    const curSec = videoTime % 60;
    const totMin = Math.floor(totalVideoTime / 60);
    const totSec = totalVideoTime % 60;
    const curSecStr = curSec < 10 ? '0' + curSec : curSec;
    const totSecStr = totSec < 10 ? '0' + totSec : totSec;

    return (
      <div className="modal-overlay open" role="dialog" aria-modal="true" onClick={handleCloseClick}>
        <div className="modal-wrapper video-modal-wrapper" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close-btn" onClick={handleCloseClick} aria-label="Close Video">
            <i className="fa-solid fa-xmark"></i>
          </button>
          <div className="modal-content video-modal-content">
            <div className="simulated-video-player">
              <div className="simulated-video-screen">
                <div className="video-playback-overlay">
                  <div className="playback-controls">
                    <button onClick={() => setIsPlaying(!isPlaying)}>
                      <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                    </button>
                    <div className="progress-bar-sim">
                      <div className="progress-filled-sim" style={{ width: `${percent}%` }}></div>
                    </div>
                    <span className="video-timer">{curMin}:{curSecStr} / {totMin}:{totSecStr}</span>
                    <button><i className="fa-solid fa-volume-high"></i></button>
                    <button><i className="fa-solid fa-expand"></i></button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Project details render layout
  if (modalType === 'project') {
    const data = projectsData[targetId];
    if (!data) return null;

    return (
      <div className="modal-overlay open" role="dialog" aria-modal="true" onClick={handleCloseClick}>
        <div className="modal-wrapper details-modal-wrapper" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close-btn" onClick={handleCloseClick} aria-label="Close details">
            <i className="fa-solid fa-xmark"></i>
          </button>
          <div className="modal-content details-modal-content">
            <div className="modal-project-content">
              <div className="modal-project-gallery">
                <img src={data.image} alt={data.title} className="modal-gallery-img" />
              </div>
              <div className="modal-project-body">
                <span className="modal-project-category">{data.category}</span>
                <h3 className="modal-project-title">{data.title}</h3>
                <p className="modal-project-desc">{data.description}</p>
                
                <ul className="modal-specs-list">
                  <li className="modal-spec-item"><i className="fa-solid fa-location-dot"></i> <span><strong>Location:</strong> {data.location}</span></li>
                  <li className="modal-spec-item"><i className="fa-solid fa-ruler-combined"></i> <span><strong>Floor Unit:</strong> {data.size}</span></li>
                  <li className="modal-spec-item"><i className="fa-solid fa-building"></i> <span><strong>Structure:</strong> {data.floors}</span></li>
                  <li className="modal-spec-item"><i className="fa-solid fa-square-parking"></i> <span><strong>Parking:</strong> {data.parking}</span></li>
                  <li className="modal-spec-item"><i className="fa-solid fa-elevator"></i> <span><strong>Elevators:</strong> {data.elevators}</span></li>
                  <li className="modal-spec-item"><i className="fa-solid fa-bolt"></i> <span><strong>Electricity:</strong> {data.power}</span></li>
                </ul>

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
                  <a href="#contact" onClick={handleScrollToContact} className="btn btn-primary" style={{ flex: '1 1 auto', textAlign: 'center' }}>
                    <span>Request Layout PDF <i className="fa-solid fa-arrow-right"></i></span>
                  </a>
                  <Link href={`/project/${targetId}`} onClick={handleCloseClick} className="btn btn-secondary" style={{ flex: '1 1 auto', textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--accent-gold)' }}>
                    <span>View Page <i className="fa-solid fa-arrow-up-right-from-square" style={{ marginLeft: '8px' }}></i></span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // News detailed render layout
  if (modalType === 'news') {
    const data = newsData[targetId];
    if (!data) return null;

    return (
      <div className="modal-overlay open" role="dialog" aria-modal="true" onClick={handleCloseClick}>
        <div className="modal-wrapper details-modal-wrapper" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close-btn" onClick={handleCloseClick} aria-label="Close news details">
            <i className="fa-solid fa-xmark"></i>
          </button>
          <div className="modal-content details-modal-content">
            <div className="modal-news-body">
              <h3 className="modal-news-title">{data.title}</h3>
              <span className="modal-news-date">{data.date}</span>
              <div className="modal-news-rich-text">
                {data.content.map((p, idx) => (
                  <p key={idx} className="modal-news-p">{p}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
