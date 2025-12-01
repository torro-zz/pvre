/**
 * Admin utilities for PVRE
 *
 * Admin access is controlled by the ADMIN_EMAIL environment variable.
 * Set this to your Google OAuth email address.
 */

/**
 * Check if an email address has admin access
 */
export function isAdmin(email: string | null | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) {
    console.warn('ADMIN_EMAIL environment variable is not set')
    return false
  }
  return !!email && email.toLowerCase() === adminEmail.toLowerCase()
}

/**
 * Get the admin email from environment (for display purposes only)
 */
export function getAdminEmail(): string | undefined {
  return process.env.ADMIN_EMAIL
}
