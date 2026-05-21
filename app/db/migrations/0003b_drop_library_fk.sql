-- Run only if library_documents was created with a foreign key that blocks inserts.
ALTER TABLE `library_documents` DROP FOREIGN KEY `library_documents_uploaded_by_local_users_id_fk`;
