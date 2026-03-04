class Work < ApplicationRecord
  has_many :collection_works, dependent: :destroy
  has_many :collections, through: :collection_works
  has_many :included_works, dependent: :destroy
  has_many :circle_works, dependent: :destroy
  has_many :circles, through: :circle_works
  has_one_attached :image

  validates :title, presence: true
  validates :title_reading, format: { with: /\A[ァ-ヿ]+\z/, message: "must be full-width katakana" }
  # validates :version, presence: true, allow_blank: true
  # validates :description, presence: true, allow_blank: true
  validates :published_on, presence: true
  # validates :orig_published_on
  validates :medium, presence: true
  # validates :size, presence: true, unless: :digital?
  validates :download_source, presence: true, if: :digital?
  validates :digital, inclusion: { in: [true, false] }
  validates :adult, inclusion: { in: [true, false] }

  def digital?
    digital
  end

  def adult?
    adult
  end
end
