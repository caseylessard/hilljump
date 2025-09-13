// Google Analytics utility functions
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

export const initializeAnalytics = () => {
  // Analytics is already initialized in index.html
  console.log('Google Analytics initialized');
};

export const trackEvent = (
  eventName: string,
  parameters?: {
    event_category?: string;
    event_label?: string;
    value?: number;
    [key: string]: any;
  }
) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, parameters);
  }
};

export const trackPageView = (pagePath: string, pageTitle?: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', import.meta.env.VITE_GOOGLE_ANALYTICS_MEASUREMENT_ID, {
      page_path: pagePath,
      page_title: pageTitle,
    });
  }
};

// Common event tracking functions
export const analytics = {
  // Page tracking
  pageView: (page: string, title?: string) => trackPageView(page, title),
  
  // User interactions
  buttonClick: (buttonName: string, location?: string) => 
    trackEvent('button_click', { 
      event_category: 'engagement',
      event_label: buttonName,
      button_location: location 
    }),
  
  // ETF interactions
  etfView: (symbol: string) => 
    trackEvent('etf_view', { 
      event_category: 'etf_interaction',
      event_label: symbol 
    }),
  
  etfRankingSort: (sortBy: string) => 
    trackEvent('ranking_sort', { 
      event_category: 'etf_interaction',
      event_label: sortBy 
    }),
  
  // Portfolio tracking
  portfolioAdd: (symbol: string) => 
    trackEvent('portfolio_add', { 
      event_category: 'portfolio',
      event_label: symbol 
    }),
  
  portfolioRemove: (symbol: string) => 
    trackEvent('portfolio_remove', { 
      event_category: 'portfolio',
      event_label: symbol 
    }),
  
  // Authentication
  userSignUp: () => 
    trackEvent('sign_up', { event_category: 'auth' }),
  
  userSignIn: () => 
    trackEvent('sign_in', { event_category: 'auth' }),
  
  // Search and filters
  search: (searchTerm: string, resultCount?: number) => 
    trackEvent('search', { 
      event_category: 'search',
      event_label: searchTerm,
      result_count: resultCount 
    }),
  
  filterApply: (filterType: string, filterValue: string) => 
    trackEvent('filter_apply', { 
      event_category: 'filter',
      event_label: `${filterType}:${filterValue}` 
    }),
};