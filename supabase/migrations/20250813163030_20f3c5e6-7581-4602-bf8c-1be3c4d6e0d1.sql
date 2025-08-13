-- Allow service role to update ETF data
CREATE POLICY "Service can update ETF data" 
ON public.etfs 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- Allow service role to insert ETF data if needed
CREATE POLICY "Service can insert ETF data" 
ON public.etfs 
FOR INSERT 
WITH CHECK (true);