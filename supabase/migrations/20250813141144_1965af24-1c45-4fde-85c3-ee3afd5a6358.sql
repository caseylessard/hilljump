-- Add summary column to etfs table
ALTER TABLE public.etfs 
ADD COLUMN summary text;