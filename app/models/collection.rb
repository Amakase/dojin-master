class Collection < ApplicationRecord
  belongs_to :user
  has_many :collection_works, dependent: :destroy
  has_many :works, through: :collection_works

  validates :name, presence: true
end
