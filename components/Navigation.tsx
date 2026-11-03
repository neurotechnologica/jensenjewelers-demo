
import React from 'react';
import { AppView } from '../types';

interface NavigationProps {
  onNavigate: (view: AppView) => void;
  currentView: AppView;
}

export const Navigation: React.FC<NavigationProps> = ({ onNavigate, currentView }) => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-white/20 px-6 py-4 flex justify-between items-center">
      <div 
        className="flex items-center gap-2 cursor-pointer group"
        onClick={() => onNavigate(AppView.LANDING)}
      >
        <div className="w-8 h-8 bg-navy-900 rounded-lg flex items-center justify-center text-white font-bold group-hover:scale-110 transition-transform">F</div>
        <span className="text-xl font-bold tracking-tighter serif">Fourcee</span>
      </div>
      
      <div className="hidden md:flex items-center gap-8 text-sm font-medium uppercase tracking-widest text-navy-800">
        <button onClick={() => onNavigate(AppView.LANDING)} className="hover:text-navy-500 transition-colors">Experience</button>
        <button className="hover:text-navy-500 transition-colors">Features</button>
        <button onClick={() => onNavigate(AppView.BLOG)} className="hover:text-navy-500 transition-colors">Insights</button>
        <button 
          onClick={() => onNavigate(AppView.CHECKOUT)}
          className="bg-navy-900 text-white px-6 py-2 rounded-full hover:bg-navy-800 transition-all hover:shadow-lg active:scale-95"
        >
          Get Started
        </button>
      </div>
      
      <button className="md:hidden text-navy-900">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>
    </nav>
  );
};
