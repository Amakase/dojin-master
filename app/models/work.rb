class Work < ApplicationRecord
  validates :title, presence: true
  validates :title_reading, presence: true
  validates :version, presence: true
  validates :description, presence: true
  validates :pubished_on, presence: true
  validates :orig_published_on, presence: true
  validates :medium, presence: true
  validates :size, presence: true
  validates :download_source, presence: true

  has_many :collections, dependent: :destory
  has_many :users, through: :collections
end
