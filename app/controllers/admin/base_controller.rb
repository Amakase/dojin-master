# Shared parent for all admin controllers.
# Pundit is skipped for the admin namespace via the ApplicationController regex, so
# access control is enforced here with a simple admin flag check instead.
class Admin::BaseController < ApplicationController
  before_action :require_admin!

  private

  def require_admin!
    return if current_user&.admin?
    flash[:alert] = "Not authorized."
    redirect_to root_path
  end
end
