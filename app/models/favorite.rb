class Favorite < ApplicationRecord
  belongs_to :user
  belongs_to :booth

  validates :priority, inclusion: { in: 1..9, message: "error" }
end
