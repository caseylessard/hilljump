// Security monitoring stubs
export const useSecurityMonitoring = () => {
  return {
    logFailedLogin: async (email: string, error: string) => {
      console.log('Failed login logged:', { email, error });
    },
    logSuccessfulLogin: async () => {
      console.log('Successful login logged');
    },
    logSuspiciousActivity: async (type: string, data: any) => {
      console.log('Suspicious activity logged:', { type, data });
    }
  };
};