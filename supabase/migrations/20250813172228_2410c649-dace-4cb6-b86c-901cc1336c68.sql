-- Enable RLS on the security_recommendations table
ALTER TABLE public.security_recommendations ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing security recommendations (admin only if needed)
CREATE POLICY "Anyone can view security recommendations" 
ON public.security_recommendations 
FOR SELECT 
USING (true);