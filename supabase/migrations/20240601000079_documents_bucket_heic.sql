-- =====================================================================
-- documents bucket: accept HEIC/HEIF
--
-- The API has allowed these since the scanner shipped
-- (`validation.ALLOWED_MIME`) and the upload sheet advertises "HEIC" in so many
-- words, but the bucket's own whitelist never listed them. So a photo taken on
-- an iPhone — the default format on every iPhone since iOS 11 — passed
-- validation and was then rejected by storage, which is the least useful place
-- for an upload to fail.
-- =====================================================================

UPDATE storage.buckets
   SET allowed_mime_types = ARRAY[
         'application/pdf',
         'image/jpeg',
         'image/png',
         'image/webp',
         'image/heic',
         'image/heif',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
       ]
 WHERE id = 'documents';
