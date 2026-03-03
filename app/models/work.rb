class Work < ApplicationRecord
  has_many :collection_works, dependent: :destroy
  has_many :collections, through: :collection_works
  has_many :included_works, dependent: :destroy
  has_many :circle_works, dependent: :destroy
  has_many :circles, through: :circle_works
  has_one_attached :image

  validates :title, presence: true
  validates :title_reading, presence: true
  # validates :version, presence: true
  # validates :description, allow_blank: true
  validates :published_on, presence: true
  # validates :orig_published_on, presence: true
  # validates :medium, presence: true
  # validates :size, presence: true
  # validates :download_source, presence: { scope: :digital }
end
