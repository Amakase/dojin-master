class Favorite < ApplicationRecord
  belongs_to :user
  belongs_to :booth

  validates :priority, inclusion: { in: 1..9, message: "must be an integer between 1 and 9 inclusive" }, allow_nil: true
  validates :notes, presence: true, allow_blank: true
end
