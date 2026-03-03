class Notification < ApplicationRecord
  belongs_to :booth

  validates :source, presence: true
  validates :content, presence: true
  validates :url, presence: true
end
