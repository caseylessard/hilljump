const Footer = () => {
  return (
    <footer className="border-t border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container py-8 px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center items-center gap-4">
            <a 
              href="/privacy" 
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Privacy Policy
            </a>
            <span className="text-muted-foreground">•</span>
            <a 
              href="/terms" 
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Terms of Service
            </a>
          </div>
          <p className="text-sm text-muted-foreground max-w-4xl mx-auto leading-relaxed">
            The information provided by HillJump is for informational and educational purposes only. 
            HillJump does not provide financial, investment, legal, or tax advice. 
            Past performance is not a guarantee of future results. 
            You are solely responsible for your financial decisions.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;