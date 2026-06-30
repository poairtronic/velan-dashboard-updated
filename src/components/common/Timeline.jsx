import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, Activity } from 'lucide-react';

export default function Timeline({ events = [] }) {
  if (!events || events.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500 italic">
        No recent events recorded.
      </div>
    );
  }

  const getIconForType = (type) => {
    switch(type) {
      case 'error':
      case 'failure':
        return <XCircle className="w-5 h-5 text-accent-red" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'success':
      case 'recovery':
        return <CheckCircle2 className="w-5 h-5 text-accent-teal" />;
      case 'info':
        return <Info className="w-5 h-5 text-accent-blue" />;
      default:
        return <Activity className="w-5 h-5 text-gray-400" />;
    }
  };

  const getBorderColor = (type) => {
    switch(type) {
      case 'error':
      case 'failure':
        return 'border-accent-red';
      case 'warning':
        return 'border-yellow-500';
      case 'success':
      case 'recovery':
        return 'border-accent-teal';
      case 'info':
        return 'border-accent-blue';
      default:
        return 'border-gray-600';
    }
  };

  return (
    <div className="relative space-y-8 py-4">
      {/* Center Vertical Line (Desktop) */}
      <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 bg-gradient-to-b from-transparent via-gray-700 to-transparent"></div>
      
      {/* Left Vertical Line (Mobile) */}
      <div className="md:hidden absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-gray-700 to-transparent"></div>

      {events.map((event, idx) => {
        const isEven = idx % 2 === 0;
        
        const Card = () => (
          <div className="w-full p-4 rounded border border-gray-700 bg-gray-800/40 shadow-sm transition duration-300 hover:bg-gray-800/80 text-left">
            <div className="flex items-center justify-between space-x-2 mb-1">
              <div className="font-bold text-gray-200">{event.title}</div>
              <time className="font-mono text-xs text-gray-500">{event.timestamp}</time>
            </div>
            <div className="text-sm text-gray-400">
              {event.description}
            </div>
          </div>
        );

        return (
          <div key={idx} className="relative flex items-center md:justify-center group">
            {/* Mobile Node */}
            <div className={`md:hidden flex items-center justify-center w-10 h-10 rounded-full border-2 bg-gray-900 shadow shrink-0 z-10 ${getBorderColor(event.type)} relative`}>
              {getIconForType(event.type)}
            </div>

            {/* Mobile Card */}
            <div className="md:hidden flex-1 ml-4">
              <Card />
            </div>

            {/* Desktop Left Side */}
            <div className="hidden md:flex w-[calc(50%-2rem)] justify-end pr-4">
              {!isEven && <Card />}
            </div>

            {/* Desktop Center Node */}
            <div className={`hidden md:flex items-center justify-center w-10 h-10 rounded-full border-2 bg-gray-900 shadow shrink-0 z-10 ${getBorderColor(event.type)} relative mx-auto`}>
              {getIconForType(event.type)}
            </div>

            {/* Desktop Right Side */}
            <div className="hidden md:flex w-[calc(50%-2rem)] justify-start pl-4">
              {isEven && <Card />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
