-- Add new columns for role tracking and default selection
ALTER TABLE user_linked_accounts 
ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS user_role text,
ADD COLUMN IF NOT EXISTS can_write boolean DEFAULT false;

-- Ensure only one default account per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_default_account 
ON user_linked_accounts (user_id) 
WHERE is_default = true;