class Favorite < ApplicationRecord
  belongs_to :user
  belongs_to :booth

  validates :priority, inclusion: { in: 1..9, message: "Choose a priority between 1 to 9 inclusive" }
  validates :notes, allow_blank: true
end
