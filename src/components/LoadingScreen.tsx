interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      <div className="animate-bounce">
        <img 
          src="/lovable-uploads/81de2019-2acd-4cc3-8af5-508908a6fbc2.png" 
          alt="HillJump Logo" 
          className="w-20 h-20"
        />
      </div>
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
