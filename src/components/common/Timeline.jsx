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
    <div className="relative pl-6 space-y-8 before:absolute before:inset-0 before:ml-8 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-700 before:to-transparent">
      {events.map((event, idx) => (
        <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          {/* Timeline Node */}
          <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 bg-gray-900 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${getBorderColor(event.type)} relative z-10`}>
            {getIconForType(event.type)}
          </div>
          {/* Content Card */}
          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-gray-700 bg-gray-800/40 shadow-sm transition duration-300 hover:bg-gray-800/80">
            <div className="flex items-center justify-between space-x-2 mb-1">
              <div className="font-bold text-gray-200">{event.title}</div>
              <time className="font-mono text-xs text-gray-500">{event.timestamp}</time>
            </div>
            <div className="text-sm text-gray-400">
              {event.description}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
