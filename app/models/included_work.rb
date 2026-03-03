class IncludedWork < ApplicationRecord
  belongs_to :work

  validates :title, presence: true
end
