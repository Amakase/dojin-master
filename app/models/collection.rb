class Collection < ApplicationRecord
  belongs_to :user
  belongs_to :work

  validates :name, presence: true
end
