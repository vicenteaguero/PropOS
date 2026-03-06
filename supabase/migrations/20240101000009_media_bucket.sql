-- Media storage bucket for photos and audio
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload to the media bucket
CREATE POLICY "Tenant media upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media');

-- Anyone can read media files (public bucket)
CREATE POLICY "Public media read" ON storage.objects
  FOR SELECT USING (bucket_id = 'media');
